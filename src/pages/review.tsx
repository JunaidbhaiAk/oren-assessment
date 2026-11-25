import { useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ReviewDialog } from "@/components/reports/ReviewDialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/months";
import { ROLES, hasRole } from "@/lib/roles";
import { api } from "@/utils/api";

export default function ReviewPage() {
	const me = api.session.me.useQuery();
	const isReviewer = me.data ? hasRole(me.data, ROLES.REVIEWER) : false;
	const queue = api.review.queue.useQuery(undefined, { enabled: isReviewer });
	const [openId, setOpenId] = useState<string | null>(null);

	// Months with something to look at come first, then oldest first.
	const rows = [...(queue.data ?? [])].sort((a, b) => Number(b.flagCount > 0) - Number(a.flagCount > 0));

	return (
		<AppLayout title="Review">
			<PageHeader bordered>
				<PageHeaderHeading>Waiting for review</PageHeaderHeading>
				<PageHeaderDescription>
					Months with big changes come first, so look there before the rest.
				</PageHeaderDescription>
			</PageHeader>

			{me.data && !isReviewer ? (
				<EmptyState>
					<EmptyStateTitle>Only reviewers can see this</EmptyStateTitle>
					<EmptyStateDescription>Switch to a reviewer to check submitted months.</EmptyStateDescription>
				</EmptyState>
			) : queue.isSuccess && rows.length === 0 ? (
				<EmptyState>
					<EmptyStateTitle>Nothing waiting</EmptyStateTitle>
					<EmptyStateDescription>When a plant submits a month, it shows here.</EmptyStateDescription>
				</EmptyState>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Plant</TableHead>
							<TableHead>Month</TableHead>
							<TableHead>Submitted</TableHead>
							<TableHead>Needs a look</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow
								key={row.reportId}
								className="cursor-pointer"
								onClick={() => setOpenId(row.reportId)}
								data-testid={`queue-row-${row.plantCode}-${row.year}-${row.month}`}
							>
								<TableCell className="font-medium">
									{row.plantCode} {row.plantName}
								</TableCell>
								<TableCell>
									{MONTH_NAMES[row.month - 1]} {row.year}
								</TableCell>
								<TableCell>{row.submittedAt ? formatDateTime(row.submittedAt) : ""}</TableCell>
								<TableCell>
									{row.ownPlant ? (
										<Badge tone="neutral">Your plant</Badge>
									) : row.flagCount > 0 ? (
										<Badge tone="warning">
											{row.flagCount} big {row.flagCount === 1 ? "change" : "changes"}
										</Badge>
									) : (
										<Badge tone="success">Looks normal</Badge>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<ReviewDialog reportId={openId} onClose={() => setOpenId(null)} />
		</AppLayout>
	);
}
