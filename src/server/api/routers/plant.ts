import { TRPCError } from "@trpc/server";

import { ROLES, hasRole } from "@/lib/roles";
import {
  plantByIdInput,
  plantDetail,
  plantListInput,
  plantListItem,
  plantSummary,
  plantUpdateInput,
} from "@/lib/schemas/plant";
import { protectedProcedure, router } from "@/server/api/trpc";
import { requireRole } from "@/server/helpers/roles";
import {
  getPlantDetail,
  listPlants,
  updatePlant,
} from "@/server/services/plant";

const notFound = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "We could not find this plant.",
  });

export const plantRouter = router({
  list: protectedProcedure
    .input(plantListInput)
    .output(plantListItem.array())
    .query(({ ctx, input }) =>
      listPlants(ctx.db, {
        search: input.search,
        companyId: ctx.user.companyId,
        // A plain data owner sees their own plants. Reviewers and the Head see the whole company.
        userId: hasRole(ctx.user, ROLES.REVIEWER, ROLES.SUSTAINABILITY_HEAD)
          ? undefined
          : ctx.user.id,
        viewerId: ctx.user.id,
      }),
    ),

  byId: protectedProcedure
    .input(plantByIdInput)
    .output(plantDetail)
    .query(async ({ ctx, input }) => {
      const plant = await getPlantDetail(ctx.db, ctx.user, input.id);
      if (!plant) {
        throw notFound();
      }
      return plant;
    }),

  update: protectedProcedure
    .input(plantUpdateInput)
    .output(plantSummary)
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ROLES.SUSTAINABILITY_HEAD);
      const plant = await updatePlant(ctx.db, ctx.user, input);
      if (!plant) {
        throw notFound();
      }
      return plant;
    }),
});
