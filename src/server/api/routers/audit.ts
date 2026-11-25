import { ROLES } from "@/lib/roles";
import { auditInput, auditPage } from "@/lib/schemas/audit";
import { protectedProcedure, router } from "@/server/api/trpc";
import { requireRole } from "@/server/helpers/roles";
import { listAudit } from "@/server/services/audit";

/** Who did what, for the Head of Sustainability and reviewers. */
export const auditRouter = router({
	list: protectedProcedure
		.input(auditInput)
		.output(auditPage)
		.query(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.SUSTAINABILITY_HEAD, ROLES.REVIEWER);
			return listAudit(ctx.db, ctx.user, input);
		}),
});
