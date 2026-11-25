"use client";

import { useBudgetVsActual, useSetBudgetLink } from "@/hooks/useReports";
import Spinner from "@/components/ui/Spinner";

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetVsActualCard({ year, month }: { year: number; month: number | null }) {
  const { data, isLoading } = useBudgetVsActual(year, month);
  const setLink = useSetBudgetLink();

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Presupuesto vs real (costos fijos)</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">
          Presupuesto = lo configurado en Costos → Costos Fijos{month ? " (por mes)" : " × 12 meses"}. Real = lo que registraste en Egresos en la categoría vinculada. Vincula cada costo fijo con su categoría de egreso en la última columna.
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !data || data.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-gray-500">No hay costos fijos configurados en Costos → Costos Fijos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Costo fijo</th>
                <th className="px-4 py-2 font-medium text-right">Presupuesto</th>
                <th className="px-4 py-2 font-medium text-right">Real</th>
                <th className="px-4 py-2 font-medium text-right">Diferencia</th>
                <th className="px-4 py-2 font-medium">Categoría de egreso</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const over = (r.diff ?? 0) > 0;
                const pct = r.diff != null && r.budget > 0 ? Math.round((r.diff / r.budget) * 100) : null;
                return (
                  <tr key={r.fixed_cost_id} className="border-b border-slate-50 dark:border-gray-700/50">
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">{r.name}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{fmt(r.budget)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-gray-200">
                      {r.real != null ? fmt(r.real) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${r.diff == null ? "text-slate-300" : over ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      {r.diff != null ? `${over ? "+" : ""}${fmt(r.diff)}${pct != null ? ` (${over ? "+" : ""}${pct}%)` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={r.category_id ?? ""}
                        disabled={setLink.isPending}
                        onChange={(e) => setLink.mutate({ fixed_cost_id: r.fixed_cost_id, category_id: e.target.value || null })}
                        className="w-full max-w-[180px] rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-slate-700 dark:text-gray-200"
                      >
                        <option value="">Sin vincular</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-700/30">
                <td className="px-4 py-2.5">Total vinculado</td>
                <td className="px-4 py-2.5 text-right">{fmt(data.total_budget_linked)}</td>
                <td className="px-4 py-2.5 text-right">{fmt(data.total_real_linked)}</td>
                <td className={`px-4 py-2.5 text-right ${data.total_real_linked - data.total_budget_linked > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {data.total_real_linked - data.total_budget_linked > 0 ? "+" : ""}{fmt(data.total_real_linked - data.total_budget_linked)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          {data.others.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-700 text-xs">
              <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-gray-400">
                Otros gastos “ya cubiertos” sin costo fijo vinculado (solo gasto real)
              </p>
              {data.others.map((o) => (
                <div key={o.category_id} className="flex justify-between py-0.5 text-slate-600 dark:text-gray-300">
                  <span>{o.label}</span>
                  <span className="font-medium">{fmt(o.real)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="px-4 py-2.5 text-[11px] text-slate-400 dark:text-gray-500 border-t border-slate-100 dark:border-gray-700">
            En rojo = gastaste más de lo presupuestado; si se repite varios meses, actualiza el costo fijo en Costos para que precios y punto de equilibrio usen el promedio real.
          </p>
        </div>
      )}
    </div>
  );
}
