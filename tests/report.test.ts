import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ROLES } from "@/lib/roles";
import { prisma } from "@/server/db";

import { callerFor, createTestCompany, createTestPlant, createTestUser, deleteTestCompany } from "./helpers";

const FULL = [
	{ itemKey: "coal", quantity: 100, unit: "t" },
	{ itemKey: "petcoke", quantity: 10, unit: "t" },
	{ itemKey: "diesel", quantity: 5, unit: "kL" },
	{ itemKey: "furnace_oil", quantity: 0, unit: "t" },
	{ itemKey: "grid_power", quantity: 900000, unit: "kWh" },
	{ itemKey: "clinker", quantity: 500, unit: "t" },
] as const;

// A month that has certainly ended.
const key = (plantId: string, month = 1) => ({ plantId, year: 2020, month });

let fx: Awaited<ReturnType<typeof setUp>>;

async function setUp() {
	const company = await createTestCompany();
	const [owner, other, reviewer] = await Promise.all([
		createTestUser(company.id, [ROLES.DATA_OWNER], "Owner"),
		createTestUser(company.id, [ROLES.DATA_OWNER], "Other owner"),
		createTestUser(company.id, [ROLES.REVIEWER], "Reviewer"),
	]);
	const plant = await createTestPlant(company.id);
	const grinding = await createTestPlant(company.id, { code: "P02", type: "GRINDING_UNIT" });
	await prisma.plant.update({ where: { id: plant.id }, data: { dataOwners: { connect: { id: owner.id } } } });
	await prisma.plant.update({ where: { id: grinding.id }, data: { dataOwners: { connect: { id: owner.id } } } });
	return { company, owner, other, reviewer, plant, grinding };
}

beforeAll(async () => {
	fx = await setUp();
});
afterAll(() => deleteTestCompany(fx.company.id));

describe("report entry", () => {
	it("saves a draft and records the change", async () => {
		const owner = callerFor(fx.owner);
		const saved = await owner.report.save({ ...key(fx.plant.id), lines: FULL.slice(0, 2).map((l) => ({ ...l })) });
		expect(saved.status).toBe("DRAFT");
		expect(saved.missing).toContain("diesel");

		const log = await prisma.changeLog.findMany({ where: { companyId: fx.company.id, entityType: "report" } });
		expect(log.map((l) => l.action).sort()).toEqual(["create", "save"]);
	});

	it("cannot submit with items missing", async () => {
		await expect(callerFor(fx.owner).report.submit(key(fx.plant.id))).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("submits a full month, then locks it", async () => {
		const owner = callerFor(fx.owner);
		await owner.report.save({ ...key(fx.plant.id), lines: FULL.map((l) => ({ ...l })) });
		expect((await owner.report.submit(key(fx.plant.id))).status).toBe("SUBMITTED");
		await expect(owner.report.save({ ...key(fx.plant.id), lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("does not need clinker at a grinding unit", async () => {
		const owner = callerFor(fx.owner);
		await owner.report.save({
			...key(fx.grinding.id),
			lines: FULL.filter((l) => l.itemKey !== "clinker").map((l) => ({ ...l })),
		});
		expect((await owner.report.submit(key(fx.grinding.id))).status).toBe("SUBMITTED");
	});

	it("rejects a future month, a wrong unit and another owner", async () => {
		const owner = callerFor(fx.owner);
		const future = { plantId: fx.plant.id, year: 2100, month: 1 };
		await expect(owner.report.save({ ...future, lines: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			owner.report.save({ ...key(fx.plant.id, 2), lines: [{ itemKey: "coal", quantity: 1, unit: "kWh" }] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(callerFor(fx.other).report.month(key(fx.plant.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(callerFor(fx.reviewer).report.month(key(fx.plant.id))).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
