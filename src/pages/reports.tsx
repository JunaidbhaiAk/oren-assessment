import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { MonthDialog, type MonthTarget } from "@/components/reports/MonthDialog";
import { OrenButton } from "@/components/ui/OrenButton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/ui/page-header";
import { OrenSelect } from "@/components/ui/select";
import { MONTH_NAMES, STATUS_TONES, monthHasEnded } from "@/lib/months";
import { ROLES, hasRole } from "@/lib/roles";
import { STATUS_LABELS } from "@/lib/schemas/report";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";

export default function ReportsPage() {
	const me = api.session.me.useQuery();
	const isOwner = me.data ? hasRole(me.data, ROLES.DATA_OWNER) : false;
	const plants = api.plant.list.useQuery({}, { enabled: isOwner });
	const [plantId, setPlantId] = useState("");
	const [year, setYear] = useState(new Date().getFullYear());
	const [target, setTarget] = useState<MonthTarget | null>(null);

	const plant = plants.data?.find((p) => p.id === plantId) ?? plants.data?.[0];
	useEffect(() => {
		if (!plantId && plant) setPlantId(plant.id);
	}, [plantId, plant]);

	const overview = api.report.year.useQuery({ plantId: plant?.id ?? "", year }, { enabled: !!plant });

	return (
		<AppLayout title="Monthly data">
			<PageHeader bordered>
				<PageHeaderHeading>Monthly data</PageHeaderHeading>
				<PageHeaderDescription>Pick a month to enter, check or fix your plant's data.</PageHeaderDescription>
			</PageHeader>

			{me.data && !isOwner ? (
				<EmptyState>
					<EmptyStateTitle>Only plant data owners send monthly data</EmptyStateTitle>
					<EmptyStateDescription>Switch to a plant data owner to enter a month.</EmptyStateDescription>
				</EmptyState>
			) : plant ? (
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-end justify-between gap-3">
						{plants.data && plants.data.length > 1 ? (
							<OrenSelect
								label="Plant"
								className="max-w-xs"
								value={plant.id}
								options={plants.data.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))}
								onValueChange={setPlantId}
							/>
						) : (
							<p className="text-sm font-medium text-text-primary">
								{plant.code} {plant.name}
							</p>
						)}
						<div className="flex items-center gap-2">
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
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="year-grid">
						{(
							overview.data ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, status: "NOT_STARTED" as const }))
						).map(({ month, status }) => {
							const ended = monthHasEnded(year, month);
							return (
								<button
									key={month}
									type="button"
									disabled={!ended}
									onClick={() => setTarget({ plantId: plant.id, plantType: plant.type, year, month })}
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
			) : plants.isSuccess ? (
				<EmptyState>
					<EmptyStateTitle>No plants assigned</EmptyStateTitle>
					<EmptyStateDescription>You are not the data owner of any plant yet.</EmptyStateDescription>
				</EmptyState>
			) : null}

			<MonthDialog target={target} onClose={() => setTarget(null)} />
		</AppLayout>
	);
}
