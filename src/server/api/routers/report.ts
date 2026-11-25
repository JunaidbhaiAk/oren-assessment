import { ROLES } from "@/lib/roles";
import { monthDetail, monthKey, saveReportInput, yearInput, yearOverview } from "@/lib/schemas/report";
import { protectedProcedure, router } from "@/server/api/trpc";
import { requireRole } from "@/server/helpers/roles";
import { getMonth, getYearOverview, saveMonth, submitMonth } from "@/server/services/report";

/** A plant's monthly data, entered by its data owner. */
export const reportRouter = router({
	year: protectedProcedure
		.input(yearInput)
		.output(yearOverview)
		.query(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.DATA_OWNER);
			return getYearOverview(ctx.db, ctx.user, input);
		}),

	month: protectedProcedure
		.input(monthKey)
		.output(monthDetail)
		.query(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.DATA_OWNER);
			return getMonth(ctx.db, ctx.user, input);
		}),

	save: protectedProcedure
		.input(saveReportInput)
		.output(monthDetail)
		.mutation(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.DATA_OWNER);
			return saveMonth(ctx.db, ctx.user, input);
		}),

	submit: protectedProcedure
		.input(monthKey)
		.output(monthDetail)
		.mutation(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.DATA_OWNER);
			return submitMonth(ctx.db, ctx.user, input);
		}),
});
