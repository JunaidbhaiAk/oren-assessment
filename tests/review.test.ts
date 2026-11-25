import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ROLES } from "@/lib/roles";
import { prisma } from "@/server/db";
import { compareLines } from "@/server/services/review";

import { callerFor, createTestCompany, createTestPlant, createTestUser, deleteTestCompany } from "./helpers";

const lines = (coal: number) => [
	{ itemKey: "coal", quantity: coal, unit: "t" },
	{ itemKey: "petcoke", quantity: 10, unit: "t" },
	{ itemKey: "diesel", quantity: 5, unit: "kL" },
	{ itemKey: "furnace_oil", quantity: 0, unit: "t" },
	{ itemKey: "grid_power", quantity: 900_000, unit: "kWh" },
	{ itemKey: "clinker", quantity: 500, unit: "t" },
];

let fx: Awaited<ReturnType<typeof setUp>>;

async function setUp() {
	const company = await createTestCompany();
	const [owner, reviewer, reviewerOwner] = await Promise.all([
		createTestUser(company.id, [ROLES.DATA_OWNER], "Owner"),
		createTestUser(company.id, [ROLES.REVIEWER], "Reviewer"),
		createTestUser(company.id, [ROLES.REVIEWER, ROLES.DATA_OWNER], "Reviewer owner"),
	]);
	const plant = await createTestPlant(company.id);
	const ownPlant = await createTestPlant(company.id, { code: "P02" });
	await prisma.plant.update({ where: { id: plant.id }, data: { dataOwners: { connect: { id: owner.id } } } });
	await prisma.plant.update({
		where: { id: ownPlant.id },
		data: { dataOwners: { connect: { id: reviewerOwner.id } } },
	});
	return { company, owner, reviewer, reviewerOwner, plant, ownPlant };
}

async function submit(user: { id: string }, plantId: string, month: number, coal = 100) {
	const key = { plantId, year: 2020, month };
	const caller = callerFor(user);
	await caller.report.save({ ...key, lines: lines(coal) as never });
	await caller.report.submit(key);
	const row = await prisma.monthlyReport.findUniqueOrThrow({ where: { plantId_year_month: key } });
	return row.id;
}

beforeAll(async () => {
	fx = await setUp();
});
afterAll(() => deleteTestCompany(fx.company.id));

describe("review", () => {
	it("approves a month and logs it", async () => {
		const id = await submit(fx.owner, fx.plant.id, 1);
		expect((await callerFor(fx.reviewer).review.queue()).some((q) => q.reportId === id)).toBe(true);
		await callerFor(fx.reviewer).review.approve({ reportId: id });
		const row = await prisma.monthlyReport.findUniqueOrThrow({ where: { id } });
		expect(row).toMatchObject({ status: "APPROVED", reviewedById: fx.reviewer.id });
		const log = await prisma.changeLog.findFirst({ where: { entityId: id, action: "approve" } });
		expect(log?.changedById).toBe(fx.reviewer.id);
	});

	it("flags a big jump against the last approved month", async () => {
		const id = await submit(fx.owner, fx.plant.id, 2, 200);
		const detail = await callerFor(fx.reviewer).review.detail({ reportId: id });
		expect(detail.previousPeriod).toBe("2020-01");
		expect(detail.lines.find((l) => l.itemKey === "coal")).toMatchObject({ flagged: true, change: 1 });
		expect(detail.flagCount).toBe(1);
	});

	it("sends back with a comment, which the owner can read and then resubmit", async () => {
		const id = await prisma.monthlyReport.findUniqueOrThrow({
			where: { plantId_year_month: { plantId: fx.plant.id, year: 2020, month: 2 } },
		});
		await expect(callerFor(fx.reviewer).review.sendBack({ reportId: id.id, comment: " " })).rejects.toBeTruthy();
		await callerFor(fx.reviewer).review.sendBack({ reportId: id.id, comment: "Coal looks doubled." });
		const month = await callerFor(fx.owner).report.month({ plantId: fx.plant.id, year: 2020, month: 2 });
		expect(month).toMatchObject({ status: "CHANGES_REQUESTED", reviewComment: "Coal looks doubled." });
		expect((await callerFor(fx.owner).report.submit({ plantId: fx.plant.id, year: 2020, month: 2 })).status).toBe(
			"SUBMITTED",
		);
	});

	it("cannot decide twice", async () => {
		const id = await submit(fx.owner, fx.plant.id, 3);
		await callerFor(fx.reviewer).review.approve({ reportId: id });
		await expect(callerFor(fx.reviewer).review.approve({ reportId: id })).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("keeps a reviewer from reviewing their own plant, and owners from reviewing", async () => {
		const id = await submit(fx.reviewerOwner, fx.ownPlant.id, 1);
		await expect(callerFor(fx.reviewerOwner).review.approve({ reportId: id })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const queue = await callerFor(fx.reviewerOwner).review.queue();
		expect(queue.find((q) => q.reportId === id)?.ownPlant).toBe(true);
		await expect(callerFor(fx.owner).review.queue()).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("compareLines", () => {
	it("compares across units", () => {
		const [line] = compareLines(
			[{ itemKey: "grid_power", quantity: 2000, unit: "kWh" }],
			[{ itemKey: "grid_power", quantity: 1, unit: "MWh" }],
		);
		expect(line?.change).toBe(1);
	});
});
