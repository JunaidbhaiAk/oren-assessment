import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { OrenButton } from "@/components/ui/OrenButton";
import { OrenInput } from "@/components/ui/OrenInput";
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
import { OrenSelect } from "@/components/ui/select";
import { EMISSION_FACTORS } from "@/lib/factors";
import { MONTH_NAMES, STATUS_TONES } from "@/lib/months";
import { type MonthStatus, STATUS_LABELS, isEditable, requiredItems, unitsFor } from "@/lib/schemas/report";
import { UNITS, type Unit } from "@/lib/units";
import { api } from "@/utils/api";

type Entry = { quantity: string; unit: Unit };

export type MonthTarget = { plantId: string; plantType: "INTEGRATED" | "GRINDING_UNIT"; year: number; month: number };

export function MonthDialog({ target, onClose }: { target: MonthTarget | null; onClose: () => void }) {
	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl" closeButtonDataTestId="month-close">
				{target && <MonthForm target={target} onClose={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function MonthForm({ target, onClose }: { target: MonthTarget; onClose: () => void }) {
	const { plantId, plantType, year, month } = target;
	const key = { plantId, year, month };
	const utils = api.useContext();
	const detail = api.report.month.useQuery(key);
	const [entries, setEntries] = useState<Record<string, Entry>>({});

	// Load what was saved, once, when the month opens.
	const loaded = detail.data;
	useEffect(() => {
		if (!loaded) return;
		setEntries(
			Object.fromEntries(loaded.lines.map((l) => [l.itemKey, { quantity: String(l.quantity), unit: l.unit }])),
		);
	}, [loaded]);

	const refresh = () =>
		Promise.all([utils.report.year.invalidate({ plantId, year }), utils.report.month.invalidate(key)]);
	const onError = (error: { message: string }) => toast.error(error.message);
	const save = api.report.save.useMutation({ onError });
	const submit = api.report.submit.useMutation({ onError });

	const status: MonthStatus = detail.data?.status ?? "NOT_STARTED";
	const editable = isEditable(status);
	const required = requiredItems(plantType);

	/** The lines to send: every item with a number entered. */
	function lines() {
		return Object.entries(entries)
			.filter(([, e]) => e.quantity.trim() !== "" && Number.isFinite(Number(e.quantity)))
			.map(([itemKey, e]) => ({ itemKey, quantity: Number(e.quantity), unit: e.unit }));
	}

	async function onSave() {
		await save.mutateAsync({ ...key, lines: lines() });
		await refresh();
		toast.success("Saved. You can come back to this month later.");
	}

	async function onSubmit() {
		await save.mutateAsync({ ...key, lines: lines() });
		await submit.mutateAsync(key);
		await refresh();
		toast.success("Sent for review.");
		onClose();
	}

	const missing = required.filter((k) => entries[k]?.quantity.trim() === "" || entries[k] === undefined);
	const busy = save.isLoading || submit.isLoading;

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{MONTH_NAMES[month - 1]} {year}
				</DialogTitle>
				<DialogDescription>
					<Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
				</DialogDescription>
			</DialogHeader>
			<DialogBody scrollable className="flex flex-col gap-4">
				{detail.data?.status === "CHANGES_REQUESTED" && detail.data.reviewComment && (
					<p
						className="rounded-lg bg-badge-warning-soft-bg p-3 text-sm text-badge-warning-soft-text"
						data-testid="month-comment"
					>
						Reviewer: {detail.data.reviewComment}
					</p>
				)}
				{detail.isLoading ? (
					<p className="text-sm text-text-secondary">Loading</p>
				) : (
					EMISSION_FACTORS.map((factor) => {
						const entry = entries[factor.key] ?? { quantity: "", unit: factor.unit };
						const optional = !required.includes(factor.key);
						return (
							<div key={factor.key} className="grid grid-cols-[1fr_8rem] items-end gap-3">
								<OrenInput
									label={`${factor.label}${optional ? " (optional)" : ""}`}
									type="number"
									min={0}
									step="any"
									inputMode="decimal"
									disabled={!editable}
									value={entry.quantity}
									onChange={(e) =>
										setEntries((prev) => ({ ...prev, [factor.key]: { ...entry, quantity: e.target.value } }))
									}
									data-testid={`month-qty-${factor.key}`}
								/>
								<OrenSelect
									aria-label={`${factor.label} unit`}
									disabled={!editable}
									value={entry.unit}
									options={unitsFor(factor.key).map((u) => ({ value: u, label: UNITS[u].label }))}
									onValueChange={(unit) =>
										setEntries((prev) => ({ ...prev, [factor.key]: { ...entry, unit: unit as Unit } }))
									}
									data-testid={`month-unit-${factor.key}`}
								/>
							</div>
						);
					})
				)}
			</DialogBody>
			<DialogFooter>
				<OrenButton variant="secondary" onClick={onClose} data-testid="month-cancel">
					{editable ? "Cancel" : "Close"}
				</OrenButton>
				{editable && (
					<>
						<OrenButton
							variant="outline"
							onClick={onSave}
							isLoading={save.isLoading && !submit.isLoading}
							data-testid="month-save"
						>
							Save draft
						</OrenButton>
						<OrenButton
							onClick={onSubmit}
							disabled={busy || missing.length > 0}
							isLoading={submit.isLoading}
							data-testid="month-submit"
						>
							{status === "CHANGES_REQUESTED" ? "Resubmit" : "Submit"}
						</OrenButton>
					</>
				)}
			</DialogFooter>
		</>
	);
}
