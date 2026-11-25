import type { Prisma } from "@prisma/client";

import type { AuditPage } from "@/lib/schemas/audit";
import type { SessionUser } from "@/lib/schemas/session";
import type { Db } from "@/server/db";
import type { FieldChanges } from "@/server/helpers/changeLog";
import { companyScope } from "@/server/helpers/scope";

const PAGE_SIZE = 30;

/** The company's change log, newest first, with each entry tied to its plant and month. */
export async function listAudit(
	db: Db,
	user: SessionUser,
	input: { plantId?: string; reportId?: string; cursor?: string },
): Promise<AuditPage> {
	let where: Prisma.ChangeLogWhereInput = companyScope(user);
	if (input.reportId) {
		where = { ...where, entityType: "report", entityId: input.reportId };
	} else if (input.plantId) {
		const reports = await db.monthlyReport.findMany({
			where: companyScope(user, { plantId: input.plantId }),
			select: { id: true },
		});
		where = {
			...where,
			OR: [
				{ entityType: "report", entityId: { in: reports.map((r) => r.id) } },
				{ entityType: "plant", entityId: input.plantId },
			],
		};
	}

	const rows = await db.changeLog.findMany({
		where,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: PAGE_SIZE + 1,
		...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
		select: {
			id: true,
			createdAt: true,
			action: true,
			entityType: true,
			entityId: true,
			changes: true,
			changedBy: { select: { name: true } },
		},
	});
	const page = rows.slice(0, PAGE_SIZE);

	const reportIds = page.filter((r) => r.entityType === "report").map((r) => r.entityId);
	const plantIds = page.filter((r) => r.entityType === "plant").map((r) => r.entityId);
	const reports = await db.monthlyReport.findMany({
		where: { id: { in: reportIds } },
		select: { id: true, year: true, month: true, plant: { select: { code: true, name: true } } },
	});
	const plants = await db.plant.findMany({
		where: { id: { in: plantIds } },
		select: { id: true, code: true, name: true },
	});
	const reportById = new Map(reports.map((r) => [r.id, r]));
	const plantById = new Map(plants.map((p) => [p.id, p]));

	return {
		entries: page.map((row) => {
			const report = reportById.get(row.entityId);
			const plant = report?.plant ?? plantById.get(row.entityId);
			return {
				id: row.id,
				createdAt: row.createdAt,
				actorName: row.changedBy.name,
				action: row.action,
				entityType: row.entityType,
				plantCode: plant?.code ?? null,
				plantName: plant?.name ?? null,
				period: report ? `${report.year}-${String(report.month).padStart(2, "0")}` : null,
				reportId: report?.id ?? null,
				changes: row.changes as FieldChanges,
			};
		}),
		nextCursor: rows.length > PAGE_SIZE ? (page[page.length - 1]?.id ?? null) : null,
	};
}
