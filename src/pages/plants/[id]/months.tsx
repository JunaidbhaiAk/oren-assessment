import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PlantTypeBadge } from "@/components/plants/PlantTypeBadge";
import { MonthDialog, type MonthTarget } from "@/components/reports/MonthDialog";
import { OrenButton } from "@/components/ui/OrenButton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/ui/page-header";
import { MONTH_NAMES, STATUS_TONES, monthHasEnded } from "@/lib/months";
import { ROLES, hasRole } from "@/lib/roles";
import { STATUS_LABELS } from "@/lib/schemas/report";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";

const NOT_STARTED_YEAR = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, status: "NOT_STARTED" as const }));

export default function PlantMonthsPage() {
	const router = useRouter();
	const id = typeof router.query.id === "string" ? router.query.id : "";
	const me = api.session.me.useQuery();
	const plant = api.plant.byId.useQuery({ id }, { enabled: id !== "", retry: false });
	const [year, setYear] = useState(new Date().getFullYear());
	const [target, setTarget] = useState<MonthTarget | null>(null);

	const isOwner = me.data ? hasRole(me.data, ROLES.DATA_OWNER) : false;
	const reportsForThisPlant = !!plant.data?.dataOwners.some((o) => o.id === me.data?.id);
	const overview = api.report.year.useQuery({ plantId: id, year }, { enabled: reportsForThisPlant });

	return (
		<AppLayout title="Monthly data">
			<Link
				href="/plants"
				className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-link hover:text-text-link-hover"
				data-testid="months-back"
			>
				<ArrowLeft className="size-4" aria-hidden />
				All plants
			</Link>

			{plant.data && (
				<PageHeader bordered>
					<PageHeaderHeading>
						{plant.data.code} {plant.data.name}: monthly data
					</PageHeaderHeading>
					<PageHeaderDescription>
						<span className="inline-flex items-center gap-2">
							<PlantTypeBadge type={plant.data.type} />
							Pick a month to enter, check or fix this plant's data.
						</span>
					</PageHeaderDescription>
				</PageHeader>
			)}

			{plant.data && me.data && !(isOwner && reportsForThisPlant) ? (
				<EmptyState>
					<EmptyStateTitle>You do not report for this plant</EmptyStateTitle>
					<EmptyStateDescription>Only this plant's data owner can enter its months.</EmptyStateDescription>
				</EmptyState>
			) : plant.data ? (
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-end gap-2">
						<OrenButton
							variant="outline"
							iconOnly
							aria-label="Previous year"
							onClick={() => setYear(year - 1)}
							data-testid="year-prev"
						>
							<ChevronLeft />
						</OrenButton>
						<span className="w-16 text-center text-sm font-semibold" data-testid="year-label">
							{year}
						</span>
						<OrenButton
							variant="outline"
							iconOnly
							aria-label="Next year"
							onClick={() => setYear(year + 1)}
							data-testid="year-next"
						>
							<ChevronRight />
						</OrenButton>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="year-grid">
						{(overview.data ?? NOT_STARTED_YEAR).map(({ month, status }) => {
							const ended = monthHasEnded(year, month);
							return (
								<button
									key={month}
									type="button"
									disabled={!ended}
									onClick={() => setTarget({ plantId: id, plantType: plant.data.type, year, month })}
									data-testid={`month-${month}`}
									className={cn(
										"flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface-card p-4 text-left",
										"transition-colors enabled:hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
										"disabled:cursor-not-allowed disabled:opacity-50",
									)}
								>
									<span className="text-sm font-semibold text-text-primary">{MONTH_NAMES[month - 1]}</span>
									{ended ? (
										<Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
									) : (
										<span className="text-xs text-text-secondary">Not ended yet</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			) : plant.isError ? (
				<EmptyState>
					<EmptyStateTitle>We could not find this plant</EmptyStateTitle>
					<EmptyStateDescription>It may have been removed.</EmptyStateDescription>
				</EmptyState>
			) : null}

			<MonthDialog target={target} onClose={() => setTarget(null)} />
		</AppLayout>
	);
}
