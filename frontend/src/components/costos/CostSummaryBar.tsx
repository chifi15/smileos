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
          <span className="text-slate-500 dark:text-gray-400">Costo operativo</span>
          <span className="ml-2 font-semibold text-slate-800 dark:text-white">{fmtC(totalMaterialsCost)}</span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-gray-600" />
        <div>
          <span className="text-slate-500 dark:text-gray-400">Precio paciente</span>
          <span className="ml-2 font-semibold text-blue-700 dark:text-blue-400">{fmtC(finalPrice)}</span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-gray-600" />
        <div>
          <span className="text-slate-500 dark:text-gray-400">Margen</span>
          <span className="ml-2 font-semibold text-green-700 dark:text-green-400">{fmtC(margin)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-gray-700 sm:grid-cols-4">
        <SummaryCell label="Materiales" value={totalMaterialsCost} />
        <SummaryCell label="Honorarios" value={professionalFees} />
        <SummaryCell label="Costos fijos" value={fixedCosts} />
        <SummaryCell label="Subtotal" value={subtotal} highlight />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-700 px-5 py-4 bg-blue-50 dark:bg-blue-900/20">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total</p>
        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmtC(finalPrice)}</p>
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
    <div className={`px-5 py-4 ${highlight ? "bg-slate-50 dark:bg-gray-700/50" : ""}`}>
      <p className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</p>
      <p className={`text-base font-semibold ${highlight ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-gray-300"}`}>
        {fmtC(value)}
      </p>
    </div>
  );
}
