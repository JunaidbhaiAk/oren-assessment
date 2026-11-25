import { TRPCError } from "@trpc/server";

import {
	type MonthDetail,
	type MonthKey,
	type MonthStatus,
	type SaveReportInput,
	type YearOverview,
	isEditable,
	requiredItems,
	unitsFor,
} from "@/lib/schemas/report";
import type { SessionUser } from "@/lib/schemas/session";
import type { Db } from "@/server/db";
import { type FieldChanges, recordChange } from "@/server/helpers/changeLog";
import { companyScope } from "@/server/helpers/scope";
import type { PrismaClient } from "@prisma/client";

const fail = (code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN", message: string) => new TRPCError({ code, message });

/** The plant, if it is in the user's company and the user reports for it. */
async function ownPlant(db: Db, user: SessionUser, plantId: string) {
	const plant = await db.plant.findFirst({
		where: companyScope(user, { id: plantId, dataOwners: { some: { id: user.id } } }),
		select: { id: true, type: true },
	});
	if (!plant) throw fail("NOT_FOUND", "We could not find this plant.");
	return plant;
}

/** A month can be reported once it has ended. */
function assertEnded({ year, month }: Pick<MonthKey, "year" | "month">, now = new Date()) {
	if (year * 12 + month >= now.getFullYear() * 12 + now.getMonth() + 1) {
		throw fail("BAD_REQUEST", "This month has not ended yet.");
	}
}

export async function getYearOverview(
	db: Db,
	user: SessionUser,
	input: Pick<MonthKey, "plantId" | "year">,
): Promise<YearOverview> {
	await ownPlant(db, user, input.plantId);
	const rows = await db.monthlyReport.findMany({
		where: { plantId: input.plantId, year: input.year },
		select: { month: true, status: true },
	});
	const byMonth = new Map(rows.map((row) => [row.month, row.status]));
	return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, status: byMonth.get(i + 1) ?? "NOT_STARTED" }));
}

function missingItems(plantType: "INTEGRATED" | "GRINDING_UNIT", entered: string[]): string[] {
	return requiredItems(plantType).filter((key) => !entered.includes(key));
}

export async function getMonth(db: Db, user: SessionUser, input: MonthKey): Promise<MonthDetail> {
	const plant = await ownPlant(db, user, input.plantId);
	const report = await db.monthlyReport.findUnique({
		where: { plantId_year_month: { plantId: plant.id, year: input.year, month: input.month } },
		select: {
			status: true,
			reviewComment: true,
			submittedAt: true,
			lines: { select: { itemKey: true, quantity: true, unit: true } },
		},
	});
	const lines = (report?.lines ?? []) as MonthDetail["lines"];
	return {
		status: report?.status ?? "NOT_STARTED",
		reviewComment: report?.reviewComment ?? null,
		submittedAt: report?.submittedAt ?? null,
		lines,
		missing: missingItems(
			plant.type,
			lines.map((l) => l.itemKey),
		),
	};
}

/** Loads the month's report for a change, creating a draft if the month was not started. Locked months throw. */
async function editableReport(tx: Db, user: SessionUser, input: MonthKey) {
	const plant = await ownPlant(tx, user, input.plantId);
	assertEnded(input);
	const key = { plantId: plant.id, year: input.year, month: input.month };
	const existing = await tx.monthlyReport.findUnique({
		where: { plantId_year_month: key },
		select: { id: true, status: true, lines: { select: { itemKey: true, quantity: true, unit: true } } },
	});
	if (existing && !isEditable(existing.status)) {
		throw fail("FORBIDDEN", "This month is with a reviewer or already approved, so it cannot be changed.");
	}
	return { plant, key, existing };
}

/** Saves the month's items as a draft. Replaces what was saved before. */
export async function saveMonth(db: PrismaClient, user: SessionUser, input: SaveReportInput): Promise<MonthDetail> {
	await db.$transaction(async (tx) => {
		const { plant, key, existing } = await editableReport(tx, user, input);
		const seen = new Set<string>();
		for (const line of input.lines) {
			if (seen.has(line.itemKey)) throw fail("BAD_REQUEST", "Each item can be entered once.");
			seen.add(line.itemKey);
			if (!unitsFor(line.itemKey).includes(line.unit)) throw fail("BAD_REQUEST", "Choose a unit that fits this item.");
		}

		const report =
			existing ??
			(await tx.monthlyReport.create({
				data: { ...key, companyId: user.companyId },
				select: { id: true, status: true, lines: true },
			}));
		if (!existing) {
			await recordChange(tx, user, {
				entityType: "report",
				entityId: report.id,
				action: "create",
				changes: {
					period: { from: null, to: `${input.year}-${String(input.month).padStart(2, "0")}` },
					plantId: { from: null, to: plant.id },
				},
			});
		}

		const before = new Map((existing?.lines ?? []).map((l) => [l.itemKey, `${l.quantity} ${l.unit}`]));
		const after = new Map(input.lines.map((l) => [l.itemKey, `${l.quantity} ${l.unit}`]));
		const changes: FieldChanges = {};
		for (const itemKey of new Set([...before.keys(), ...after.keys()])) {
			const from = before.get(itemKey) ?? null;
			const to = after.get(itemKey) ?? null;
			if (from !== to) changes[itemKey] = { from, to };
		}

		await tx.reportLine.deleteMany({ where: { reportId: report.id } });
		await tx.reportLine.createMany({ data: input.lines.map((l) => ({ ...l, reportId: report.id })) });
		if (Object.keys(changes).length > 0) {
			await recordChange(tx, user, { entityType: "report", entityId: report.id, action: "save", changes });
		}
	});
	return getMonth(db, user, input);
}

/** Sends the month to review. Every required item must be entered. */
export async function submitMonth(db: PrismaClient, user: SessionUser, input: MonthKey): Promise<MonthDetail> {
	await db.$transaction(async (tx) => {
		const { plant, existing } = await editableReport(tx, user, input);
		if (!existing) throw fail("BAD_REQUEST", "Enter the month's data before submitting.");
		if (
			missingItems(
				plant.type,
				existing.lines.map((l) => l.itemKey),
			).length > 0
		) {
			throw fail("BAD_REQUEST", "Enter every item before submitting.");
		}
		await tx.monthlyReport.update({
			where: { id: existing.id },
			data: { status: "SUBMITTED", submittedAt: new Date() },
		});
		await recordChange(tx, user, {
			entityType: "report",
			entityId: existing.id,
			action: existing.status === "CHANGES_REQUESTED" ? "resubmit" : "submit",
			changes: { status: { from: existing.status, to: "SUBMITTED" satisfies MonthStatus } },
		});
	});
	return getMonth(db, user, input);
}
