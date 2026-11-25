import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { OrenButton } from "@/components/ui/OrenButton";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/ui/page-header";
import { OrenSelect } from "@/components/ui/select";
import { describeEntry, formatPeriod } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { ROLES, hasRole } from "@/lib/roles";
import type { AuditEntry } from "@/lib/schemas/audit";
import { api } from "@/utils/api";

const ALL_PLANTS = "all";

export default function AuditPage() {
	const router = useRouter();
	const reportId = typeof router.query.report === "string" ? router.query.report : undefined;
	const [plantId, setPlantId] = useState(ALL_PLANTS);
	const me = api.session.me.useQuery();
	const allowed = me.data ? hasRole(me.data, ROLES.SUSTAINABILITY_HEAD, ROLES.REVIEWER) : false;
	const plants = api.plant.list.useQuery({}, { enabled: allowed });
	const log = api.audit.list.useInfiniteQuery(
		{ reportId, plantId: !reportId && plantId !== ALL_PLANTS ? plantId : undefined },
		{ enabled: allowed, getNextPageParam: (page) => page.nextCursor ?? undefined },
	);
	const entries: AuditEntry[] = log.data?.pages.flatMap((page) => page.entries) ?? [];

	return (
		<AppLayout title="Audit log">
			<PageHeader bordered>
				<PageHeaderHeading>Audit log</PageHeaderHeading>
				<PageHeaderDescription>
					Every save, submission and review decision: who did it, when, and what changed.
				</PageHeaderDescription>
			</PageHeader>

			{me.data && !allowed ? (
				<EmptyState>
					<EmptyStateTitle>Only reviewers and the Head of Sustainability can see this</EmptyStateTitle>
					<EmptyStateDescription>Switch to a reviewer or to Meera Iyer.</EmptyStateDescription>
				</EmptyState>
			) : (
				<div className="flex flex-col gap-4">
					{reportId ? (
						<div className="flex items-center gap-3 text-sm">
							<span>Showing the history of one month.</span>
							<Link
								href="/audit"
								className="inline-flex items-center gap-1 text-text-link hover:text-text-link-hover"
								data-testid="audit-clear-month"
							>
								<X className="size-4" aria-hidden />
								Show everything
							</Link>
						</div>
					) : (
						<OrenSelect
							label="Plant"
							className="max-w-xs"
							value={plantId}
							options={[
								{ value: ALL_PLANTS, label: "All plants" },
								...(plants.data ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` })),
							]}
							onValueChange={setPlantId}
							data-testid="audit-plant"
						/>
					)}

					{log.isSuccess && entries.length === 0 ? (
						<EmptyState>
							<EmptyStateTitle>Nothing recorded yet</EmptyStateTitle>
							<EmptyStateDescription>Changes show here as soon as someone makes one.</EmptyStateDescription>
						</EmptyState>
					) : (
						<ol
							className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default bg-surface-card"
							data-testid="audit-list"
						>
							{entries.map((entry) => {
								const { summary, details } = describeEntry(entry);
								return (
									<li key={entry.id} className="flex flex-col gap-1 p-4" data-testid={`audit-entry-${entry.action}`}>
										<p className="text-sm text-text-primary">
											<span className="font-medium">{entry.actorName}</span> {summary}
											{entry.plantCode && (
												<>
													{" "}
													for{" "}
													<span className="font-medium">
														{entry.plantCode} {entry.plantName}
													</span>
												</>
											)}
											{entry.period && <>, {formatPeriod(entry.period)}</>}.
										</p>
										{details.length > 0 && (
											<ul className="list-disc pl-5 text-sm text-text-secondary">
												{details.map((line) => (
													<li key={line}>{line}</li>
												))}
											</ul>
										)}
										<p className="text-xs text-text-secondary">{formatDateTime(entry.createdAt)}</p>
									</li>
								);
							})}
						</ol>
					)}

					{log.hasNextPage && (
						<div className="flex justify-center">
							<OrenButton
								variant="outline"
								isLoading={log.isFetchingNextPage}
								onClick={() => void log.fetchNextPage()}
								data-testid="audit-more"
							>
								Show older
							</OrenButton>
						</div>
					)}
				</div>
			)}
		</AppLayout>
	);
}
