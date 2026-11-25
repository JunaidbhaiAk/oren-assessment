import { plantRouter } from "@/server/api/routers/plant";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { reportRouter } from "@/server/api/routers/report";
import { reviewRouter } from "@/server/api/routers/review";
import { sessionRouter } from "@/server/api/routers/session";
import { router } from "@/server/api/trpc";

export const appRouter = router({
	session: sessionRouter,
	plant: plantRouter,
	dashboard: dashboardRouter,
	report: reportRouter,
	review: reviewRouter,
});

export type AppRouter = typeof appRouter;
