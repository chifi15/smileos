"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBudgetVsActual, useSetBudgetLink, type BudgetRow } from "@/hooks/useReports";
import { useCreateTransaction } from "@/hooks/useFinances";
import Spinner from "@/components/ui/Spinner";
import type { FinanceCategory } from "@/types";

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateInMonth(year: number, month: number) {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  const last = new Date(year, month, 0).getDate(); // último día del mes elegido
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function PayRow({ row, year, month, onDone }: { row: BudgetRow; year: number; month: number; onDone: () => void }) {
  const remaining = Math.max(0, row.budget - (row.real ?? 0));
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : row.budget));
  const create = useCreateTransaction(year, month);
  const qc = useQueryClient();
  const n = parseFloat(amount);

  function save() {
    if (!n || n <= 0 || !row.category_key) return;
    create.mutate(
      {
        type: "egreso",
        category: row.category_key as FinanceCategory,
        description: row.name,
        original_amount: n,
        original_currency: "NIO",
        transaction_date: dateInMonth(year, month),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["report-budget-vs-actual"] });
          qc.invalidateQueries({ queryKey: ["report-summary"] });
          onDone();
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">C$</span>
      <input
        type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-right text-xs text-slate-700 dark:text-gray-200"
      />
      <button
        onClick={save} disabled={!n || n <= 0 || create.isPending}
        className="rounded-lg bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        Guardar
      </button>
      <button onClick={onDone} className="text-[11px] text-slate-400 hover:text-slate-600">Cancelar</button>
    </div>
  );
}

function Status({ row }: { row: BudgetRow }) {
  if (!row.category_id) return <span className="text-slate-300">—</span>;
  const real = row.real ?? 0;
  if (real <= 0) return <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Pendiente</span>;
  if (real >= row.budget * 0.99) return <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Pagado</span>;
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Parcial</span>;
}

export default function BudgetVsActualCard({ year, month }: { year: number; month: number | null }) {
  const { data, isLoading } = useBudgetVsActual(year, month);
  const setLink = useSetBudgetLink();
  const [payingId, setPayingId] = useState<string | null>(null);

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
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Categoría de egreso</th>
                {month && <th className="px-4 py-2 font-medium">Pago</th>}
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
                    <td className="px-4 py-2.5"><Status row={r} /></td>
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
                    {month && (
                      <td className="px-4 py-2.5">
                        {!r.category_id ? (
                          <span className="text-[11px] text-slate-400">Vincula una categoría</span>
                        ) : payingId === r.fixed_cost_id ? (
                          <PayRow row={r} year={year} month={month} onDone={() => setPayingId(null)} />
                        ) : (
                          <button
                            onClick={() => setPayingId(r.fixed_cost_id)}
                            className="rounded-lg border border-slate-200 dark:border-gray-600 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                          >
                            + Registrar pago
                          </button>
                        )}
                      </td>
                    )}
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
                <td />
                {month && <td />}
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
