import { Check, ChevronLeft, ChevronRight, Clock, Minus, Pencil, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { OrenButton } from "@/components/ui/OrenButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { MONTH_NAMES, monthHasEnded } from "@/lib/months";
import { ROLES, hasRole } from "@/lib/roles";
import { type MonthStatus, STATUS_LABELS } from "@/lib/schemas/report";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";

const STATUS_STYLE: Record<MonthStatus, { icon: typeof Check; className: string }> = {
	APPROVED: { icon: Check, className: "bg-badge-success-soft-bg text-badge-success-soft-text" },
	SUBMITTED: { icon: Clock, className: "bg-badge-warning-soft-bg text-badge-warning-soft-text" },
	DRAFT: { icon: Pencil, className: "bg-badge-info-soft-bg text-badge-info-soft-text" },
	CHANGES_REQUESTED: { icon: Undo2, className: "bg-badge-error-soft-bg text-badge-error-soft-text" },
	NOT_STARTED: { icon: Minus, className: "bg-badge-neutral-soft-bg text-badge-neutral-soft-text" },
};
const LEGEND: MonthStatus[] = ["APPROVED", "SUBMITTED", "CHANGES_REQUESTED", "DRAFT", "NOT_STARTED"];

function StatusCell({ status, label, due }: { status: MonthStatus; label: string; due: boolean }) {
	const { icon: Icon, className } = STATUS_STYLE[status];
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={cn("inline-flex size-7 items-center justify-center rounded-md", className, !due && "opacity-40")}
		>
			<Icon className="size-3.5" aria-hidden />
		</span>
	);
}

function Stat({ label, value, note, testId }: { label: string; value: string; note?: string; testId: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium text-text-secondary">{label}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-2xl font-semibold text-text-primary" data-testid={testId}>
					{value}
				</p>
				{note && <p className="mt-1 text-xs text-text-secondary">{note}</p>}
			</CardContent>
		</Card>
	);
}

const tonnes = (value: number) => `${formatNumber(value, 0)} t`;

export default function DashboardPage() {
	const me = api.session.me.useQuery();
	const isHead = me.data ? hasRole(me.data, ROLES.SUSTAINABILITY_HEAD) : false;
	const [year, setYear] = useState(new Date().getFullYear());
	const board = api.dashboard.year.useQuery({ year }, { enabled: isHead, keepPreviousData: true });
	const d = board.data;
	const complete = d ? d.approvedMonths === d.dueMonths : false;

	return (
		<AppLayout title="Dashboard">
			<PageHeader bordered>
				<PageHeaderHeading>CO2 for {year}</PageHeaderHeading>
				<PageHeaderDescription>
					Only approved months are counted. A month nobody has approved shows its status, never a figure.
				</PageHeaderDescription>
			</PageHeader>

			{me.data && !isHead ? (
				<EmptyState>
					<EmptyStateTitle>Only the Head of Sustainability can see this</EmptyStateTitle>
					<EmptyStateDescription>Switch to Meera Iyer to open the dashboard.</EmptyStateDescription>
				</EmptyState>
			) : (
				<div className="flex flex-col gap-6">
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
						<span className="w-16 text-center text-sm font-semibold">{year}</span>
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

					{d && (
						<>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<Stat label="Scope 1: direct" value={tonnes(d.scope1Tonnes)} testId="total-scope1" />
								<Stat label="Scope 2: bought power" value={tonnes(d.scope2Tonnes)} testId="total-scope2" />
								<Stat
									label="Approved so far"
									value={`${d.approvedMonths} of ${d.dueMonths} plant-months`}
									note={complete ? "Every month that has ended is approved." : "The totals above leave out the rest."}
									testId="total-coverage"
								/>
							</div>

							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Plant</TableHead>
										{MONTH_NAMES.map((name) => (
											<TableHead key={name} align="center" title={name}>
												{name.slice(0, 3)}
											</TableHead>
										))}
										<TableHead align="right">Scope 1</TableHead>
										<TableHead align="right">Scope 2</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{d.plants.map((plant) => (
										<TableRow key={plant.plantId} data-testid={`dash-row-${plant.code}`}>
											<TableCell className="font-medium">
												<Link href={`/plants/${plant.plantId}`} className="hover:underline">
													{plant.code}
												</Link>
												<span className="ml-2 hidden text-xs font-normal text-text-secondary xl:inline">
													{plant.name}
												</span>
											</TableCell>
											{plant.months.map((m) => {
												const due = monthHasEnded(d.year, m.month);
												const co2 =
													m.scope1Tonnes !== null
														? `, ${formatNumber((m.scope1Tonnes ?? 0) + (m.scope2Tonnes ?? 0), 0)} t CO2`
														: "";
												const label = `${plant.code} ${MONTH_NAMES[m.month - 1]}: ${STATUS_LABELS[m.status]}${co2}`;
												return (
													<TableCell
														key={m.month}
														align="center"
														className="px-1"
														data-testid={`dash-${plant.code}-${m.month}`}
													>
														<StatusCell status={m.status} label={label} due={due} />
													</TableCell>
												);
											})}
											<TableCell align="right">{tonnes(plant.scope1Tonnes)}</TableCell>
											<TableCell align="right">{tonnes(plant.scope2Tonnes)}</TableCell>
										</TableRow>
									))}
									<TableRow className="bg-surface-muted font-semibold">
										<TableCell>Company</TableCell>
										<TableCell colSpan={12} align="right" className="text-xs font-normal text-text-secondary">
											Approved months only
										</TableCell>
										<TableCell align="right">{tonnes(d.scope1Tonnes)}</TableCell>
										<TableCell align="right">{tonnes(d.scope2Tonnes)}</TableCell>
									</TableRow>
								</TableBody>
							</Table>

							<ul className="flex flex-wrap gap-3 text-xs text-text-secondary" aria-label="Legend">
								{LEGEND.map((status) => (
									<li key={status} className="flex items-center gap-1.5">
										<StatusCell status={status} label={STATUS_LABELS[status]} due />
										{STATUS_LABELS[status]}
									</li>
								))}
								<li>
									<Badge tone="neutral">Faded: month has not ended</Badge>
								</li>
							</ul>
						</>
					)}
				</div>
			)}
		</AppLayout>
	);
}
