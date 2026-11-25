import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { lineCo2Kg, quantityInFactorUnit, totalsByScope } from "@/lib/emissions";
import type { QueueItem, ReviewDetail } from "@/lib/schemas/report";
import type { SessionUser } from "@/lib/schemas/session";
import { type Unit, convert, isUnit } from "@/lib/units";
import type { Db } from "@/server/db";
import { recordChange } from "@/server/helpers/changeLog";
import { companyScope } from "@/server/helpers/scope";

/** An item is worth a look when it moves more than this against the last approved month. */
const FLAG_CHANGE = 0.3;

const fail = (code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT", message: string) =>
	new TRPCError({ code, message });

type StoredLine = { itemKey: string; quantity: number; unit: string };

/** Each line against the same item in the previous month, in the current line's unit. */
export function compareLines(current: StoredLine[], previous: StoredLine[]) {
	return current.map((line) => {
		const before = previous.find((p) => p.itemKey === line.itemKey);
		let previousQuantity: number | null = null;
		if (before && isUnit(before.unit) && isUnit(line.unit)) {
			previousQuantity = convert(before.quantity, before.unit as Unit, line.unit as Unit);
		}
		let change: number | null = null;
		let flagged = false;
		if (previousQuantity !== null) {
			if (previousQuantity === 0) {
				flagged = line.quantity > 0;
			} else {
				change = (line.quantity - previousQuantity) / previousQuantity;
				flagged = Math.abs(change) > FLAG_CHANGE;
			}
		}
		return { ...line, co2Tonnes: lineCo2Kg(line) / 1000, previousQuantity, change, flagged };
	});
}

const period = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** The plant's last approved month before this one. */
async function previousApproved(db: Db, plantId: string, year: number, month: number) {
	return db.monthlyReport.findFirst({
		where: {
			plantId,
			status: "APPROVED",
			OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
		},
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true, month: true, lines: { select: { itemKey: true, quantity: true, unit: true } } },
	});
}

async function ownPlantIds(db: Db, user: SessionUser): Promise<Set<string>> {
	const plants = await db.plant.findMany({
		where: companyScope(user, { dataOwners: { some: { id: user.id } } }),
		select: { id: true },
	});
	return new Set(plants.map((p) => p.id));
}

/** Months waiting for review, oldest first. */
export async function listQueue(db: Db, user: SessionUser): Promise<QueueItem[]> {
	const [reports, own] = await Promise.all([
		db.monthlyReport.findMany({
			where: companyScope(user, { status: "SUBMITTED" as const }),
			orderBy: { submittedAt: "asc" },
			select: {
				id: true,
				plantId: true,
				year: true,
				month: true,
				submittedAt: true,
				plant: { select: { code: true, name: true } },
				lines: { select: { itemKey: true, quantity: true, unit: true } },
			},
		}),
		ownPlantIds(db, user),
	]);
	const items = await Promise.all(
		reports.map(async (r) => {
			const prev = await previousApproved(db, r.plantId, r.year, r.month);
			const flagCount = compareLines(r.lines, prev?.lines ?? []).filter((l) => l.flagged).length;
			return {
				reportId: r.id,
				plantCode: r.plant.code,
				plantName: r.plant.name,
				year: r.year,
				month: r.month,
				submittedAt: r.submittedAt,
				flagCount,
				ownPlant: own.has(r.plantId),
			};
		}),
	);
	return items;
}

export async function getForReview(db: Db, user: SessionUser, reportId: string): Promise<ReviewDetail> {
	const report = await db.monthlyReport.findFirst({
		where: companyScope(user, { id: reportId }),
		select: {
			id: true,
			plantId: true,
			status: true,
			year: true,
			month: true,
			submittedAt: true,
			plant: { select: { code: true, name: true } },
			lines: { select: { itemKey: true, quantity: true, unit: true } },
		},
	});
	if (!report) throw fail("NOT_FOUND", "We could not find this month.");
	const [prev, own] = await Promise.all([
		previousApproved(db, report.plantId, report.year, report.month),
		ownPlantIds(db, user),
	]);
	const lines = compareLines(report.lines, prev?.lines ?? []);
	const totals = totalsByScope(report.lines);
	return {
		reportId: report.id,
		plantCode: report.plant.code,
		plantName: report.plant.name,
		year: report.year,
		month: report.month,
		status: report.status,
		submittedAt: report.submittedAt,
		flagCount: lines.filter((l) => l.flagged).length,
		ownPlant: own.has(report.plantId),
		lines,
		scope1Tonnes: totals.scope1,
		scope2Tonnes: totals.scope2,
		previousPeriod: prev ? period(prev.year, prev.month) : null,
	};
}

/** Approves or sends back a month that is waiting for review. */
async function decide(
	db: PrismaClient,
	user: SessionUser,
	reportId: string,
	decision: { status: "APPROVED" } | { status: "CHANGES_REQUESTED"; comment: string },
): Promise<void> {
	await db.$transaction(async (tx) => {
		const report = await tx.monthlyReport.findFirst({
			where: companyScope(user, { id: reportId }),
			select: { id: true, plantId: true, status: true },
		});
		if (!report) throw fail("NOT_FOUND", "We could not find this month.");
		if (report.status !== "SUBMITTED") throw fail("CONFLICT", "This month is not waiting for review any more.");
		if ((await ownPlantIds(tx, user)).has(report.plantId)) {
			throw fail("FORBIDDEN", "You report for this plant, so someone else has to review it.");
		}
		const comment = decision.status === "CHANGES_REQUESTED" ? decision.comment : null;
		// Only one reviewer wins if two decide at once.
		const { count } = await tx.monthlyReport.updateMany({
			where: { id: report.id, status: "SUBMITTED" },
			data: { status: decision.status, reviewComment: comment, reviewedById: user.id, reviewedAt: new Date() },
		});
		if (count === 0) throw fail("CONFLICT", "This month is not waiting for review any more.");
		await recordChange(tx, user, {
			entityType: "report",
			entityId: report.id,
			action: decision.status === "APPROVED" ? "approve" : "send_back",
			changes: {
				status: { from: "SUBMITTED", to: decision.status },
				...(comment ? { reviewComment: { from: null, to: comment } } : {}),
			},
		});
	});
}

export const approveMonth = (db: PrismaClient, user: SessionUser, reportId: string) =>
	decide(db, user, reportId, { status: "APPROVED" });

export const sendBackMonth = (db: PrismaClient, user: SessionUser, reportId: string, comment: string) =>
	decide(db, user, reportId, { status: "CHANGES_REQUESTED", comment });
