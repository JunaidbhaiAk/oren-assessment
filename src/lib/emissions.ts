import { EMISSION_FACTORS } from "@/lib/factors";
import { type Unit, convert, isUnit } from "@/lib/units";

type Line = { itemKey: string; quantity: number; unit: string };

/** The line's quantity in the factor's own unit, or null for an unknown item or unit. */
export function quantityInFactorUnit(line: Line): number | null {
	const factor = EMISSION_FACTORS.find((f) => f.key === line.itemKey);
	if (!factor || !isUnit(line.unit)) return null;
	return convert(line.quantity, line.unit as Unit, factor.unit);
}

/** kg of CO2 for one line. */
export function lineCo2Kg(line: Line): number {
	const factor = EMISSION_FACTORS.find((f) => f.key === line.itemKey);
	const quantity = quantityInFactorUnit(line);
	return factor && quantity !== null ? quantity * factor.kgCo2PerUnit : 0;
}

/** Tonnes of CO2 by scope. */
export function totalsByScope(lines: Line[]): { scope1: number; scope2: number } {
	const totals = { scope1: 0, scope2: 0 };
	for (const line of lines) {
		const factor = EMISSION_FACTORS.find((f) => f.key === line.itemKey);
		if (factor) totals[factor.scope === 1 ? "scope1" : "scope2"] += lineCo2Kg(line) / 1000;
	}
	return totals;
}
