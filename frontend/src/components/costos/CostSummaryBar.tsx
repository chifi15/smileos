"use client";

import { TreatmentCostBreakdown } from "@/types/costos";
import { fmtC } from "@/lib/costos-utils";

interface Props {
  breakdown: TreatmentCostBreakdown;
  compact?: boolean;
}

export default function CostSummaryBar({ breakdown, compact }: Props) {
  const {
    totalMaterialsCost,
    professionalFees,
    fixedCosts,
    subtotal,
    margin,
    calculatedPrice,
    finalPrice,
  } = breakdown;

  if (compact) {
    return (
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-slate-500">Costo operativo</span>
          <span className="ml-2 font-semibold text-slate-800">{fmtC(totalMaterialsCost)}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <span className="text-slate-500">Precio paciente</span>
          <span className="ml-2 font-semibold text-blue-700">{fmtC(finalPrice)}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <span className="text-slate-500">Margen</span>
          <span className="ml-2 font-semibold text-green-700">{fmtC(margin)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
        <SummaryCell label="Materiales" value={totalMaterialsCost} />
        <SummaryCell label="Honorarios" value={professionalFees} />
        <SummaryCell label="Costos fijos" value={fixedCosts} />
        <SummaryCell label="Subtotal" value={subtotal} highlight />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">
            Precio calculado{" "}
            <span className="text-slate-400">
              (+{(breakdown.calculatedPrice > 0
                ? (margin / (subtotal || 1)) * 100
                : 0
              ).toFixed(0)}% margen)
            </span>
          </span>
          <span className="font-semibold text-slate-700">{fmtC(calculatedPrice)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Precio al paciente</span>
          <span className="text-lg font-bold text-blue-700">{fmtC(finalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${highlight ? "bg-slate-50" : ""}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${highlight ? "text-slate-900" : "text-slate-700"}`}>
        {fmtC(value)}
      </p>
    </div>
  );
}
