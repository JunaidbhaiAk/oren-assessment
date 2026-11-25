import { totalsByScope } from "@/lib/emissions";
import { monthHasEnded } from "@/lib/months";
import type { Dashboard } from "@/lib/schemas/report";
import type { SessionUser } from "@/lib/schemas/session";
import type { Db } from "@/server/db";
import { companyScope } from "@/server/helpers/scope";

/** Every plant and month of a year with its status, and the CO2 of approved months only. */
export async function getDashboard(db: Db, user: SessionUser, year: number): Promise<Dashboard> {
	const plants = await db.plant.findMany({
		where: companyScope(user),
		orderBy: { code: "asc" },
		select: {
			id: true,
			code: true,
			name: true,
			reports: {
				where: { year },
				select: { month: true, status: true, lines: { select: { itemKey: true, quantity: true, unit: true } } },
			},
		},
	});

	const result: Dashboard = { year, plants: [], scope1Tonnes: 0, scope2Tonnes: 0, dueMonths: 0, approvedMonths: 0 };
	for (const plant of plants) {
		const byMonth = new Map(plant.reports.map((r) => [r.month, r]));
		const row = {
			plantId: plant.id,
			code: plant.code,
			name: plant.name,
			months: [] as Dashboard["plants"][number]["months"],
			approvedMonths: 0,
			scope1Tonnes: 0,
			scope2Tonnes: 0,
		};
		for (let month = 1; month <= 12; month++) {
			const report = byMonth.get(month);
			if (monthHasEnded(year, month)) result.dueMonths++;
			if (report?.status === "APPROVED") {
				const totals = totalsByScope(report.lines);
				row.months.push({ month, status: "APPROVED", scope1Tonnes: totals.scope1, scope2Tonnes: totals.scope2 });
				row.approvedMonths++;
				row.scope1Tonnes += totals.scope1;
				row.scope2Tonnes += totals.scope2;
			} else {
				row.months.push({ month, status: report?.status ?? "NOT_STARTED", scope1Tonnes: null, scope2Tonnes: null });
			}
		}
		result.approvedMonths += row.approvedMonths;
		result.scope1Tonnes += row.scope1Tonnes;
		result.scope2Tonnes += row.scope2Tonnes;
		result.plants.push(row);
	}
	return result;
}
