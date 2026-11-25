import { ROLES } from "@/lib/roles";
import { queueItem, reviewDetail, reviewIdInput, sendBackInput } from "@/lib/schemas/report";
import { protectedProcedure, router } from "@/server/api/trpc";
import { requireRole } from "@/server/helpers/roles";
import { approveMonth, getForReview, listQueue, sendBackMonth } from "@/server/services/review";

/** Reviewers check submitted months before they count. */
export const reviewRouter = router({
	queue: protectedProcedure.output(queueItem.array()).query(({ ctx }) => {
		requireRole(ctx.user, ROLES.REVIEWER);
		return listQueue(ctx.db, ctx.user);
	}),

	detail: protectedProcedure
		.input(reviewIdInput)
		.output(reviewDetail)
		.query(({ ctx, input }) => {
			requireRole(ctx.user, ROLES.REVIEWER);
			return getForReview(ctx.db, ctx.user, input.reportId);
		}),

	approve: protectedProcedure.input(reviewIdInput).mutation(async ({ ctx, input }) => {
		requireRole(ctx.user, ROLES.REVIEWER);
		await approveMonth(ctx.db, ctx.user, input.reportId);
	}),

	sendBack: protectedProcedure.input(sendBackInput).mutation(async ({ ctx, input }) => {
		requireRole(ctx.user, ROLES.REVIEWER);
		await sendBackMonth(ctx.db, ctx.user, input.reportId, input.comment);
	}),
});
