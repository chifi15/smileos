"use client";

import type { ReactNode } from "react";

function money(n: number) {
  return `C$ ${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Card({
  label, value, hint, tone = "slate", big, onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "green" | "red" | "amber" | "blue" | "slate";
  big?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    green: "bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700",
    red: "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700",
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700",
    slate: "bg-slate-50 border-slate-200 dark:bg-gray-700/40 dark:border-gray-600",
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 ${tones[tone]} ${onClick ? "cursor-pointer hover:shadow-sm transition-shadow" : ""}`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-gray-300 mb-1">{label}</p>
      <p className={`${big ? "text-2xl" : "text-xl"} font-bold ${value < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white"}`}>
        {money(value)}
      </p>
      {hint && <p className="text-[11px] text-slate-400 dark:text-gray-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <span className="hidden sm:flex items-center justify-center text-lg font-bold text-slate-300 dark:text-gray-600">{children}</span>;
}

/**
 * Resumen financiero en dos bloques:
 *  1) Dinero real: ingresos − todos los egresos (lo que entró y salió).
 *  2) Ganancia: ingresos − costos de los tratamientos − egresos que NO están ya cubiertos.
 */
export default function FinanceSummaryPanel({
  ingresos, egresos, egresosCubiertos, costosOp, countIngresos, countEgresos, onUtilityClick, extras,
}: {
  ingresos: number;
  egresos: number;
  egresosCubiertos: number;
  costosOp: number;
  countIngresos?: number;
  countEgresos?: number;
  onUtilityClick?: () => void;
  extras?: ReactNode;
}) {
  const egresosQueRestan = egresos - egresosCubiertos;
  const dineroQueQuedo = ingresos - egresos;
  const utilidad = ingresos - costosOp - egresosQueRestan;
  const utilidadSinCubiertas = ingresos - costosOp - egresos;
  const margen = ingresos > 0 ? Math.round((utilidad / ingresos) * 1000) / 10 : 0;

  return (
    <div className="space-y-5">
      <details className="rounded-lg bg-slate-50 dark:bg-gray-700/30 border border-slate-100 dark:border-gray-700 px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-gray-300">¿Cómo leer estos números?</summary>
        <ul className="mt-2 list-disc pl-4 space-y-1 leading-snug">
          <li><strong>Dinero real:</strong> lo que entró menos todo lo que pagaste. Es lo que pasó con tu efectivo este mes.</li>
          <li><strong>Ganancia:</strong> lo que ganaste por los tratamientos que hiciste. Cada tratamiento ya trae su costo (materiales, doctor y parte de los costos fijos), así que los egresos marcados “Ya cubierta” no se restan otra vez.</li>
          <li>Comprar mucho material baja el <em>dinero real</em> ese mes, pero no la <em>ganancia</em>: el material cuenta cuando lo usas.</li>
          <li>Marca las categorías “Ya cubierta” en Finanzas → Categorías de egreso.</li>
        </ul>
      </details>

      {/* 1 · Dinero real */}
      <section>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">1 · Dinero real del mes</h3>
          <p className="text-xs text-slate-400 dark:text-gray-500">Lo que entró y lo que salió de tu bolsillo.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3">
          <Card label="Ingresos" value={ingresos} tone="green" hint={countIngresos != null ? `${countIngresos} cobros` : undefined} />
          <Op>−</Op>
          <Card label="Egresos (todos)" value={egresos} tone="red" hint={countEgresos != null ? `${countEgresos} pagos registrados` : "Todo lo que pagaste"} />
          <Op>=</Op>
          <Card label="Dinero que quedó" value={dineroQueQuedo} tone="blue" big hint="Sin importar si el gasto ya estaba en un tratamiento" />
        </div>
      </section>

      {/* 2 · Ganancia */}
      <section>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">2 · Ganancia del mes</h3>
          <p className="text-xs text-slate-400 dark:text-gray-500">Lo que ganaste por tus tratamientos, sin contar dos veces un mismo gasto.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-3">
          <Card label="Ingresos" value={ingresos} tone="green" />
          <Op>−</Op>
          <Card label="Costo de los tratamientos" value={costosOp} tone="amber" hint="Materiales, doctor y parte de costos fijos" />
          <Op>−</Op>
          <Card label="Egresos que sí se restan" value={egresosQueRestan} tone="red" hint="Categorías sin marcar “Ya cubierta”" />
          <Op>=</Op>
          <Card label="Utilidad" value={utilidad} tone="blue" big onClick={onUtilityClick} hint={`Margen ${margen}%${onUtilityClick ? " · clic para ver detalle" : ""}`} />
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-100 dark:border-gray-700 px-3 py-2 text-slate-500 dark:text-gray-400">
            Egresos “Ya cubierta” (no se restaron): <strong className="text-slate-700 dark:text-gray-200">{money(egresosCubiertos)}</strong>
            <span className="block text-[11px] text-slate-400 dark:text-gray-500">Ya están dentro del costo de los tratamientos.</span>
          </div>
          <div className="rounded-lg border border-slate-100 dark:border-gray-700 px-3 py-2 text-slate-500 dark:text-gray-400">
            Utilidad si NO marcaras ninguna como cubierta: <strong className={utilidadSinCubiertas < 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-gray-200"}>{money(utilidadSinCubiertas)}</strong>
            <span className="block text-[11px] text-slate-400 dark:text-gray-500">Resta todos los egresos y además los costos de los tratamientos (cuenta dos veces lo cubierto).</span>
          </div>
        </div>
      </section>

      {extras && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-gray-200">3 · Otros datos</h3>
          {extras}
        </section>
      )}
    </div>
  );
}
