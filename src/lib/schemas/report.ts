import { z } from "zod";

import { EMISSION_FACTORS } from "@/lib/factors";
import { UNITS, type Unit } from "@/lib/units";

export const REPORT_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] as const;
export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

/** A month with no report row is NOT_STARTED. */
export type MonthStatus = ReportStatusValue | "NOT_STARTED";

export const STATUS_LABELS: Record<MonthStatus, string> = {
	NOT_STARTED: "Not started",
	DRAFT: "Draft",
	SUBMITTED: "In review",
	APPROVED: "Approved",
	CHANGES_REQUESTED: "Sent back",
};

/** The plant can edit a month only while it is a draft or has been sent back. */
export function isEditable(status: MonthStatus): boolean {
	return status === "NOT_STARTED" || status === "DRAFT" || status === "CHANGES_REQUESTED";
}

const itemKeys = EMISSION_FACTORS.map((factor) => factor.key) as [string, ...string[]];
const unitKeys = Object.keys(UNITS) as [Unit, ...Unit[]];

/** Same-dimension units a plant may enter an item in. */
export function unitsFor(itemKey: string): Unit[] {
	const factor = EMISSION_FACTORS.find((f) => f.key === itemKey);
	if (!factor) return [];
	const dimension = UNITS[factor.unit].dimension;
	return unitKeys.filter((unit) => UNITS[unit].dimension === dimension);
}

/** Items a plant must report before submitting. Grinding units make no clinker, so it is optional there. */
export function requiredItems(plantType: "INTEGRATED" | "GRINDING_UNIT"): string[] {
	return EMISSION_FACTORS.filter((f) => plantType === "INTEGRATED" || f.key !== "clinker").map((f) => f.key);
}

// Inputs

export const monthKey = z.object({
	plantId: z.string().min(1),
	year: z.number().int().min(2000).max(2100),
	month: z.number().int().min(1).max(12),
});
export type MonthKey = z.infer<typeof monthKey>;

export const yearInput = monthKey.pick({ plantId: true, year: true });

export const reportLineInput = z.object({
	itemKey: z.enum(itemKeys),
	quantity: z.number().finite().min(0, "Enter zero or more.").max(1e12),
	unit: z.enum(unitKeys),
});
export type ReportLineInput = z.infer<typeof reportLineInput>;

export const saveReportInput = monthKey.extend({
	lines: z.array(reportLineInput).max(EMISSION_FACTORS.length),
});
export type SaveReportInput = z.infer<typeof saveReportInput>;

// Outputs

export const reportLine = reportLineInput;

export const monthDetail = z.object({
	status: z.enum(["NOT_STARTED", ...REPORT_STATUSES]),
	reviewComment: z.string().nullable(),
	submittedAt: z.date().nullable(),
	lines: z.array(reportLine),
	/** Items still to enter before the month can be submitted. */
	missing: z.array(z.string()),
});
export type MonthDetail = z.infer<typeof monthDetail>;

export const yearOverview = z.array(
	z.object({ month: z.number().int(), status: z.enum(["NOT_STARTED", ...REPORT_STATUSES]) }),
);
export type YearOverview = z.infer<typeof yearOverview>;
