"use client";

import { useState } from "react";
import Spinner from "@/components/ui/Spinner";
import { useDistribution, useSetDistributionConfig, type Distribution } from "@/hooks/useReports";

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MontoField({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [val, setVal] = useState(String(value));
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-slate-400">C$</span>
      <input
        type="number" min="0" step="any" value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { const n = parseFloat(val); if (!isNaN(n) && n >= 0 && n !== value) onSave(n); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        aria-label="Monto mensual para mejoras"
        className="w-24 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-right text-xs text-slate-700 dark:text-gray-200"
      />
      <span className="text-slate-400">al mes</span>
    </span>
  );
}

function Line({ label, hint, amount, total, control, sub }: {
  label: string; hint: string; amount: number; total: number; control?: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-gray-700">
      <div className="min-w-0">
        <p className="font-medium text-slate-600 dark:text-gray-300">{label} {control}</p>
        <p className="text-[11px] text-slate-400">{hint}</p>
        {sub}
      </div>
      <div className="text-right whitespace-nowrap">
        <p className="font-semibold text-slate-700 dark:text-gray-200">{fmt(amount)}</p>
        <p className="text-[10px] text-slate-400">{total > 0 ? `${((amount / total) * 100).toFixed(1)}% del total` : "—"}</p>
      </div>
    </div>
  );
}

function Body({ d }: { d: Distribution }) {
  const save = useSetDistributionConfig();
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-gray-700/40">
        <span className="font-medium text-slate-600 dark:text-gray-300">Total cobrado</span>
        <span className="font-semibold text-slate-700 dark:text-gray-200">{fmt(d.cobrado)}</span>
      </div>
      {d.doctores.map((x) => (
        <Line key={x.doctor_name} label={`Para ${x.doctor_name}`} hint={`${x.pct}% de lo cobrado en sus tratamientos`} amount={x.monto} total={d.cobrado} />
      ))}
      <Line
        label="Reposición de materiales y gastos"
        hint="Dinero real que hay que volver a tener para seguir trabajando"
        amount={d.reposicion} total={d.cobrado}
        sub={
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
            Materiales usados {fmt(d.materiales)} · Laboratorio pagado {fmt(d.laboratorio)} · Gastos fijos {fmt(d.fijos)}
            {d.n_meses > 1 ? ` (${d.n_meses} meses)` : ""}
          </p>
        }
      />
      <Line
        label="Fondo de mejoras"
        hint="Lo que deciden apartar cada mes para equipos y mejoras"
        amount={d.mejoras} total={d.cobrado}
        control={<MontoField value={d.mejoras_mensual} onSave={(n) => save.mutate({ mejoras_monto: n })} />}
      />
      <div className={`flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-gray-700 ${d.duena < 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
        <div>
          <p className="font-semibold text-slate-700 dark:text-gray-200">Queda para la dueña</p>
          <p className="text-[11px] text-slate-400">Lo que sobra después de doctores, reposición y mejoras</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${d.duena < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{fmt(d.duena)}</p>
          <p className="text-[10px] text-slate-400">{d.cobrado > 0 ? `${((d.duena / d.cobrado) * 100).toFixed(1)}% del total` : "—"}</p>
        </div>
      </div>
      {d.duena < 0 && (
        <p className="px-4 py-2 text-[11px] text-red-600 dark:text-red-400">
          Lo cobrado no alcanza para cubrir doctores, reposición y mejoras. Baja el monto de mejoras o revisa si faltan cobros por registrar.
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
          Cómo dividir lo que se cobró con tus números reales: lo de cada doctor, lo que cuesta reponer materiales, laboratorio y gastos fijos, un fondo de mejoras, y lo restante es de la dueña.
        </p>
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : data ? <Body d={data} /> : null}
    </div>
  );
}
