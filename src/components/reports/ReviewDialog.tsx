import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { OrenButton } from "@/components/ui/OrenButton";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EMISSION_FACTORS } from "@/lib/factors";
import { formatNumber } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/months";
import { UNITS, type Unit } from "@/lib/units";
import { api } from "@/utils/api";

const labelOf = (key: string) => EMISSION_FACTORS.find((f) => f.key === key)?.label ?? key;
const unitLabel = (unit: string) => UNITS[unit as Unit]?.label ?? unit;

function formatChange(change: number | null): string {
	if (change === null) return "";
	return `${change > 0 ? "+" : ""}${formatNumber(change * 100)}%`;
}

export function ReviewDialog({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
	return (
		<Dialog open={reportId !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="2xl" closeButtonDataTestId="review-close">
				{reportId && <ReviewForm reportId={reportId} onClose={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function ReviewForm({ reportId, onClose }: { reportId: string; onClose: () => void }) {
	const utils = api.useContext();
	const detail = api.review.detail.useQuery({ reportId });
	const [comment, setComment] = useState("");
	const [sendingBack, setSendingBack] = useState(false);

	const done = async (message: string) => {
		await Promise.all([utils.review.queue.invalidate(), utils.review.detail.invalidate({ reportId })]);
		toast.success(message);
		onClose();
	};
	const onError = (error: { message: string }) => toast.error(error.message);
	const approve = api.review.approve.useMutation({
		onError,
		onSuccess: () => done("Approved. It now counts in the totals."),
	});
	const sendBack = api.review.sendBack.useMutation({ onError, onSuccess: () => done("Sent back to the plant.") });

	const d = detail.data;
	if (!d) return <DialogBody>{detail.isError ? "We could not load this month." : "Loading"}</DialogBody>;
	const canDecide = d.status === "SUBMITTED" && !d.ownPlant;

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{d.plantCode} {d.plantName}
				</DialogTitle>
				<DialogDescription>
					{MONTH_NAMES[d.month - 1]} {d.year}
					{d.previousPeriod
						? ` · compared with ${d.previousPeriod}, the last approved month`
						: " · no approved month to compare with"}
				</DialogDescription>
			</DialogHeader>
			<DialogBody scrollable className="flex flex-col gap-4">
				{d.ownPlant && (
					<p className="rounded-lg bg-badge-warning-soft-bg p-3 text-sm text-badge-warning-soft-text">
						You report for this plant, so another reviewer has to check this month.
					</p>
				)}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Item</TableHead>
							<TableHead align="right">Quantity</TableHead>
							<TableHead align="right">Change</TableHead>
							<TableHead align="right">CO2 (t)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{d.lines.map((line) => (
							<TableRow key={line.itemKey} data-testid={`review-line-${line.itemKey}`}>
								<TableCell className="font-medium">{labelOf(line.itemKey)}</TableCell>
								<TableCell align="right">
									{formatNumber(line.quantity, 2)} {unitLabel(line.unit)}
								</TableCell>
								<TableCell align="right">
									{line.flagged ? (
										<Badge tone="warning">
											<AlertTriangle className="size-3" aria-hidden />
											{formatChange(line.change) || "New"}
										</Badge>
									) : (
										<span className="text-text-secondary">{formatChange(line.change)}</span>
									)}
								</TableCell>
								<TableCell align="right">{formatNumber(line.co2Tonnes, 1)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				<p className="text-sm text-text-primary" data-testid="review-totals">
					Scope 1: <strong>{formatNumber(d.scope1Tonnes, 1)} t</strong> · Scope 2:{" "}
					<strong>{formatNumber(d.scope2Tonnes, 1)} t</strong>
				</p>
				{sendingBack && (
					<div className="flex flex-col gap-1.5">
						<label htmlFor="review-comment" className="text-sm font-medium text-text-primary">
							What should the plant fix?
						</label>
						<textarea
							id="review-comment"
							rows={3}
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							className="rounded-lg border-[1.5px] border-border-input bg-surface-card p-3 text-sm"
							data-testid="review-comment"
						/>
					</div>
				)}
			</DialogBody>
			<DialogFooter>
				<OrenButton variant="secondary" onClick={onClose} data-testid="review-cancel">
					Close
				</OrenButton>
				{canDecide &&
					(sendingBack ? (
						<OrenButton
							variant="destructive"
							disabled={comment.trim().length < 3}
							isLoading={sendBack.isLoading}
							onClick={() => sendBack.mutate({ reportId, comment })}
							data-testid="review-send-back-confirm"
						>
							Send back
						</OrenButton>
					) : (
						<>
							<OrenButton variant="outline" onClick={() => setSendingBack(true)} data-testid="review-send-back">
								Send back
							</OrenButton>
							<OrenButton
								isLoading={approve.isLoading}
								onClick={() => approve.mutate({ reportId })}
								data-testid="review-approve"
							>
								Approve
							</OrenButton>
						</>
					))}
			</DialogFooter>
		</>
	);
}
