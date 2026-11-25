import { EMISSION_FACTORS } from "@/lib/factors";
import { MONTH_NAMES } from "@/lib/months";
import type { AuditEntry } from "@/lib/schemas/audit";

const PLANT_FIELDS: Record<string, string> = {
	name: "name",
	town: "town",
	state: "state",
	cementCapacityTpa: "cement capacity (t a year)",
};

const show = (value: unknown) => (value === null || value === undefined || value === "" ? "blank" : String(value));

const itemLabel = (key: string) => EMISSION_FACTORS.find((f) => f.key === key)?.label ?? key;

/** "2026-10" as "October 2026". */
export function formatPeriod(period: string): string {
	const [year, month] = period.split("-");
	return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
}

/** One line saying what happened, and the detail lines under it. */
export function describeEntry(entry: AuditEntry): { summary: string; details: string[] } {
	const changes = Object.entries(entry.changes);
	if (entry.entityType === "plant") {
		return {
			summary: "edited the plant",
			details: changes.map(([field, c]) => `${PLANT_FIELDS[field] ?? field}: ${show(c.from)} to ${show(c.to)}`),
		};
	}
	switch (entry.action) {
		case "create":
			return { summary: "started the month", details: [] };
		case "save":
			return {
				summary: "saved the data",
				details: changes.map(([item, c]) => `${itemLabel(item)}: ${show(c.from)} to ${show(c.to)}`),
			};
		case "submit":
			return { summary: "submitted the month for review", details: [] };
		case "resubmit":
			return { summary: "resubmitted the month after fixing it", details: [] };
		case "approve":
			return { summary: "approved the month", details: [] };
		case "send_back": {
			const comment = entry.changes.reviewComment?.to;
			return { summary: "sent the month back", details: comment ? [`Comment: ${show(comment)}`] : [] };
		}
		default:
			return { summary: entry.action, details: [] };
	}
}
