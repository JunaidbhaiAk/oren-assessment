import { z } from "zod";

export const auditInput = z.object({
	plantId: z.string().min(1).optional(),
	/** Show the history of one month's report only. */
	reportId: z.string().min(1).optional(),
	cursor: z.string().min(1).optional(),
});

export const auditEntry = z.object({
	id: z.string(),
	createdAt: z.date(),
	actorName: z.string(),
	action: z.string(),
	entityType: z.string(),
	plantCode: z.string().nullable(),
	plantName: z.string().nullable(),
	/** "2026-10" for a month's report, null for a plant. */
	period: z.string().nullable(),
	reportId: z.string().nullable(),
	changes: z.record(z.object({ from: z.unknown(), to: z.unknown() })),
});
export type AuditEntry = z.infer<typeof auditEntry>;

export const auditPage = z.object({
	entries: z.array(auditEntry),
	nextCursor: z.string().nullable(),
});
export type AuditPage = z.infer<typeof auditPage>;
