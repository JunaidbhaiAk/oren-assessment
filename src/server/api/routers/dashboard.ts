import { ROLES } from "@/lib/roles";
import { dashboard, dashboardInput } from "@/lib/schemas/report";
import { protectedProcedure, router } from "@/server/api/trpc";
import { requireRole } from "@/server/helpers/roles";
import { getDashboard } from "@/server/services/dashboard";

/** The company picture for the Head of Sustainability. Only approved months carry figures. */
export const dashboardRouter = router({
	year: protectedProcedure
		.input(dashboardInput)
		.output(dashboard)
		.query(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.SUSTAINABILITY_HEAD);
			return getDashboard(ctx.db, ctx.user, input.year);
		}),
});
