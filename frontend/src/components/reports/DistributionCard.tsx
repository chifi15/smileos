"use client";

import { useState } from "react";
import Spinner from "@/components/ui/Spinner";
import { useDistribution, useSetDistributionConfig, type Distribution } from "@/hooks/useReports";

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PctField({ label, value, onSave }: { label: string; value: number; onSave: (n: number) => void }) {
  const [val, setVal] = useState(String(value));
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number" min="0" max="100" step="any" value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { const n = parseFloat(val); if (!isNaN(n) && n >= 0 && n <= 100 && n !== value) onSave(n); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        aria-label={label}
        className="w-14 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-right text-xs text-slate-700 dark:text-gray-200"
      />
      <span className="text-slate-400">%</span>
    </span>
  );
}

function Body({ d, year, month }: { d: Distribution; year: number; month: number | null }) {
  const save = useSetDistributionConfig();
  const pctOf = (n: number) => (d.cobrado > 0 ? `${((n / d.cobrado) * 100).toFixed(1)}%` : "—");
  const rows: { label: string; hint: string; amount: number; control?: React.ReactNode; tone?: string }[] = [
    ...d.doctores.map((x) => ({
      label: `Para ${x.doctor_name}`,
      hint: `${x.pct}% de lo cobrado en sus tratamientos`,
      amount: x.monto,
    })),
    {
      label: "Reposición de materiales y gastos",
      hint: "Para volver a comprar materiales, laboratorio y cubrir gastos fijos",
      amount: d.reposicion,
      control: <PctField label="Reposición" value={d.reposicion_pct} onSave={(n) => save.mutate({ reposicion_pct: n, mejoras_pct: d.mejoras_pct })} />,
    },
    {
      label: "Fondo de mejoras",
      hint: "Ahorro para equipos y mejoras de la clínica",
      amount: d.mejoras,
      control: <PctField label="Mejoras" value={d.mejoras_pct} onSave={(n) => save.mutate({ reposicion_pct: d.reposicion_pct, mejoras_pct: n })} />,
    },
  ];
  void year; void month;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-gray-700/40">
        <span className="font-medium text-slate-600 dark:text-gray-300">Total cobrado</span>
        <span className="font-semibold text-slate-700 dark:text-gray-200">{fmt(d.cobrado)}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-gray-700">
          <div className="min-w-0">
            <p className="font-medium text-slate-600 dark:text-gray-300">{r.label} {r.control}</p>
            <p className="text-[11px] text-slate-400">{r.hint}</p>
          </div>
          <div className="text-right whitespace-nowrap">
            <p className="font-semibold text-slate-700 dark:text-gray-200">{fmt(r.amount)}</p>
            <p className="text-[10px] text-slate-400">{pctOf(r.amount)} del total</p>
          </div>
        </div>
      ))}
      <div className={`flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-gray-700 ${d.duena < 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
        <div>
          <p className="font-semibold text-slate-700 dark:text-gray-200">Queda para la dueña</p>
          <p className="text-[11px] text-slate-400">Lo que sobra después de doctores, reposición y mejoras</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${d.duena < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{fmt(d.duena)}</p>
          <p className="text-[10px] text-slate-400">{pctOf(d.duena)} del total</p>
        </div>
      </div>
      {d.duena < 0 && (
        <p className="px-4 py-2 text-[11px] text-red-600 dark:text-red-400">
          Los porcentajes suman más de lo cobrado: baja la reposición o el fondo de mejoras.
        </p>
      )}
      {d.doctores_sin_pct.length > 0 && (
        <p className="px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400 border-t border-slate-100 dark:border-gray-700">
          Sin porcentaje en la Cuenta del doctor: {d.doctores_sin_pct.join(", ")}. Su parte no está incluida aquí.
        </p>
      )}
    </div>
  );
}

export default function DistributionCard({ year, month }: { year: number; month: number | null }) {
  const { data, isLoading } = useDistribution(year, month);
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Reparto sugerido</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">
          Cómo dividir lo que se cobró: primero lo de cada doctor, luego dinero para reponer materiales y gastos, un fondo de mejoras, y lo restante es de la dueña. Puedes cambiar los porcentajes.
        </p>
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : data ? <Body d={data} year={year} month={month} /> : null}
    </div>
  );
}
