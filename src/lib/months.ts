import type { MonthStatus } from "@/lib/schemas/report";

export const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export const STATUS_TONES: Record<MonthStatus, "neutral" | "info" | "success" | "warning" | "error"> = {
	NOT_STARTED: "neutral",
	DRAFT: "info",
	SUBMITTED: "warning",
	APPROVED: "success",
	CHANGES_REQUESTED: "error",
};

/** True once the month has ended, so it can be reported. */
export function monthHasEnded(year: number, month: number, now = new Date()): boolean {
	return year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1;
}
