// Demo months for Nimbus Cement, entered and reviewed through the real services so the audit log is real.
// Run `npm run db:seed` first. Safe to run again: a month that already has data is left alone.
import { PrismaClient } from "@prisma/client";

import type { ReportLineInput } from "@/lib/schemas/report";
import { saveMonth, submitMonth } from "@/server/services/report";
import { approveMonth, sendBackMonth } from "@/server/services/review";
import { getSessionUser } from "@/server/services/session";

const prisma = new PrismaClient();
const YEAR = 2026;

type Items = Partial<Record<ReportLineInput["itemKey"], [number, ReportLineInput["unit"]]>>;

const toLines = (items: Items): ReportLineInput[] =>
	Object.entries(items).flatMap(([itemKey, value]) =>
		value ? [{ itemKey, quantity: value[0], unit: value[1] } as ReportLineInput] : [],
	);

/** Same numbers every run: a small repeatable wobble of up to 8% either way. */
function wobble(seed: number): number {
	const x = Math.sin(seed * 9301 + 49297) * 233280;
	return 0.92 + 0.16 * (x - Math.floor(x));
}

/** A typical month for a plant, scaled from the October sample of Chittorgarh (integrated) or Paradip (grinding). */
function typicalMonth(plantType: string, capacityMt: number, seed: number): Items {
	const k = (base: number, i: number) => Math.round(base * wobble(seed * 10 + i));
	if (plantType === "INTEGRATED") {
		const s = capacityMt / 4;
		return {
			coal: [k(35_000 * s, 1), "t"],
			petcoke: [k(7_600 * s, 2), "t"],
			diesel: [k(160_000 * s, 3), "L"],
			furnace_oil: [0, "t"],
			grid_power: [k(4_500 * s, 4), "MWh"],
			clinker: [k(285_800 * s, 5), "t"],
		};
	}
	const s = capacityMt / 1.5;
	return {
		coal: [0, "t"],
		petcoke: [0, "t"],
		diesel: [k(60 * s, 1), "kL"],
		furnace_oil: [k(500 * s, 2), "t"],
		grid_power: [k(3_060 * s, 3), "MWh"],
	};
}

/** What three plants sent for October 2026, as in the files under samples/. */
const OCTOBER_SAMPLES: Record<string, Items> = {
	P01: {
		coal: [35_000, "t"],
		petcoke: [7_600, "t"],
		diesel: [160_000, "L"],
		furnace_oil: [0, "t"],
		grid_power: [4_500, "MWh"],
		clinker: [285_800, "t"],
	},
	// Nalgonda's file gives power in kWh and fuel in kL. Its numbers are far below a normal month: a good one for a reviewer to catch.
	P04: {
		coal: [11_000, "t"],
		petcoke: [1_500, "t"],
		diesel: [95, "kL"],
		furnace_oil: [0, "t"],
		grid_power: [12_300_000, "kWh"],
		clinker: [101_700, "t"],
	},
	P08: {
		coal: [0, "t"],
		petcoke: [0, "t"],
		diesel: [60, "kL"],
		furnace_oil: [500, "t"],
		grid_power: [3_060_000, "kWh"],
	},
};

async function main() {
	const company = await prisma.company.findUnique({ where: { name: "Nimbus Cement Ltd" } });
	if (!company) throw new Error("Run `npm run db:seed` first.");
	const plants = await prisma.plant.findMany({
		where: { companyId: company.id },
		orderBy: { code: "asc" },
		select: {
			id: true,
			code: true,
			type: true,
			cementCapacityTpa: true,
			dataOwners: { select: { id: true, roles: true }, orderBy: { name: "asc" } },
		},
	});
	const asUser = async (id: string) => {
		const user = await getSessionUser(prisma, id);
		if (!user) throw new Error("Seed user is missing.");
		return user;
	};
	const reviewer = await asUser(
		(await prisma.user.findUniqueOrThrow({ where: { email: "vikram.joshi@nimbuscement.in" } })).id,
	);

	for (const plant of plants) {
		// A plant's own data owner reports for it. Priya Nair also reviews, so she is never the one to send P05's data.
		const owner = plant.dataOwners.find((o) => !o.roles.includes("REVIEWER")) ?? plant.dataOwners[0];
		if (!owner) throw new Error(`${plant.code} has no data owner.`);
		const user = await asUser(owner.id);
		const capacityMt = plant.cementCapacityTpa / 1_000_000;
		const plantNo = Number(plant.code.slice(1));

		const started = new Set(
			(await prisma.monthlyReport.findMany({ where: { plantId: plant.id, year: YEAR }, select: { month: true } })).map(
				(r) => r.month,
			),
		);
		const send = async (month: number, items: Items) => {
			const key = { plantId: plant.id, year: YEAR, month };
			await saveMonth(prisma, user, { ...key, lines: toLines(items) });
			await submitMonth(prisma, user, key);
			return (await prisma.monthlyReport.findUniqueOrThrow({ where: { plantId_year_month: key } })).id;
		};

		for (let month = 1; month <= 9; month++) {
			if (started.has(month)) continue;
			const id = await send(month, typicalMonth(plant.type, capacityMt, plantNo * 100 + month));
			// September is still with the reviewers for P06 and P09.
			const waiting = month === 9 && (plant.code === "P06" || plant.code === "P09");
			if (!waiting) await approveMonth(prisma, reviewer, id);
		}

		const sample = OCTOBER_SAMPLES[plant.code];
		if (started.has(10)) {
			// Already has data: leave it.
		} else if (sample) {
			await send(10, sample);
		} else if (plant.code === "P02") {
			// Started and saved, not sent yet.
			const typical = typicalMonth(plant.type, capacityMt, plantNo * 100 + 10);
			await saveMonth(prisma, user, {
				plantId: plant.id,
				year: YEAR,
				month: 10,
				lines: toLines({ coal: typical.coal, petcoke: typical.petcoke, diesel: typical.diesel }),
			});
		} else if (plant.code === "P03") {
			// Diesel entered ten times too high: sent back with a comment.
			const typical = typicalMonth(plant.type, capacityMt, plantNo * 100 + 10);
			const id = await send(10, { ...typical, diesel: [(typical.diesel?.[0] ?? 0) * 10, "L"] });
			await sendBackMonth(
				prisma,
				reviewer,
				id,
				"Diesel is ten times last month. Is this litres or a typo? Please check and resubmit.",
			);
		}
	}

	const [reports, changes] = await Promise.all([
		prisma.monthlyReport.count({ where: { companyId: company.id } }),
		prisma.changeLog.count({ where: { companyId: company.id } }),
	]);
	console.log(`Nimbus now has ${reports} months and ${changes} audit entries.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
