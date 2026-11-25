import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ROLES } from "@/lib/roles";
import { prisma } from "@/server/db";

import { callerFor, createTestCompany, createTestPlant, createTestUser, deleteTestCompany } from "./helpers";

let fx: Awaited<ReturnType<typeof setUp>>;

async function setUp() {
	const company = await createTestCompany();
	const [owner, reviewer, head] = await Promise.all([
		createTestUser(company.id, [ROLES.DATA_OWNER], "Owner"),
		createTestUser(company.id, [ROLES.REVIEWER], "Reviewer"),
		createTestUser(company.id, [ROLES.SUSTAINABILITY_HEAD], "Head"),
	]);
	const plant = await createTestPlant(company.id);
	await prisma.plant.update({ where: { id: plant.id }, data: { dataOwners: { connect: { id: owner.id } } } });
	return { company, owner, reviewer, head, plant };
}

beforeAll(async () => {
	fx = await setUp();
});
afterAll(() => deleteTestCompany(fx.company.id));

describe("dashboard", () => {
	it("counts approved months only", async () => {
		const owner = callerFor(fx.owner);
		const lines = [
			{ itemKey: "coal", quantity: 10, unit: "t" },
			{ itemKey: "petcoke", quantity: 0, unit: "t" },
			{ itemKey: "diesel", quantity: 0, unit: "L" },
			{ itemKey: "furnace_oil", quantity: 0, unit: "t" },
			{ itemKey: "grid_power", quantity: 1000, unit: "kWh" },
			{ itemKey: "clinker", quantity: 0, unit: "t" },
		] as const;
		for (const month of [1, 2]) {
			const key = { plantId: fx.plant.id, year: 2020, month };
			await owner.report.save({ ...key, lines: lines.map((l) => ({ ...l })) });
			await owner.report.submit(key);
		}
		const jan = await prisma.monthlyReport.findUniqueOrThrow({
			where: { plantId_year_month: { plantId: fx.plant.id, year: 2020, month: 1 } },
		});
		await callerFor(fx.reviewer).review.approve({ reportId: jan.id });

		const board = await callerFor(fx.head).dashboard.year({ year: 2020 });
		const row = board.plants[0];
		expect(row?.months[0]).toMatchObject({ status: "APPROVED" });
		expect(row?.months[1]).toMatchObject({ status: "SUBMITTED", scope1Tonnes: null, scope2Tonnes: null });
		// 10 t coal x 2441 kg = 24.41 t; 1 MWh x 675 kg = 0.675 t.
		expect(board.scope1Tonnes).toBeCloseTo(24.41);
		expect(board.scope2Tonnes).toBeCloseTo(0.675);
		expect(board).toMatchObject({ approvedMonths: 1, dueMonths: 12 });
	});

	it("is for the Head only", async () => {
		await expect(callerFor(fx.reviewer).dashboard.year({ year: 2020 })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(callerFor(fx.owner).dashboard.year({ year: 2020 })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("audit log", () => {
	it("shows a month's history with who did what, for reviewers and the Head", async () => {
		const jan = await prisma.monthlyReport.findUniqueOrThrow({
			where: { plantId_year_month: { plantId: fx.plant.id, year: 2020, month: 1 } },
		});
		const page = await callerFor(fx.head).audit.list({ reportId: jan.id });
		expect(page.entries.map((e) => e.action)).toEqual(["approve", "submit", "save", "create"]);
		expect(page.entries[0]).toMatchObject({ actorName: "Reviewer", plantCode: "P01", period: "2020-01" });

		const byPlant = await callerFor(fx.reviewer).audit.list({ plantId: fx.plant.id });
		expect(byPlant.entries.length).toBeGreaterThan(4);
	});

	it("is not for data owners", async () => {
		await expect(callerFor(fx.owner).audit.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
