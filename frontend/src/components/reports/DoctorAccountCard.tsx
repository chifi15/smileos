"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { useDoctorAccount, useSetDoctorCommission } from "@/hooks/useReports";
import { useUpdateExpenseCategory } from "@/hooks/useFinances";

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short" });
}

function PctInput({ doctorId, pct }: { doctorId: string; pct: number | null }) {
  const setPct = useSetDoctorCommission();
  const [val, setVal] = useState(pct != null ? String(pct) : "");
  function save() {
    const trimmed = val.trim();
    const n = trimmed === "" ? null : parseFloat(trimmed);
    if (n !== null && (isNaN(n) || n < 0 || n > 100)) return;
    if (n === pct) return;
    setPct.mutate({ doctor_id: doctorId, pct: n });
  }
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number" min="0" max="100" step="any" value={val} placeholder="—"
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-16 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-right text-xs text-slate-700 dark:text-gray-200"
      />
      <span className="text-slate-400">%</span>
    </div>
  );
}

export default function DoctorAccountCard({ year, month }: { year: number; month: number | null }) {
  const { data, isLoading } = useDoctorAccount(year, month);
  const updateCat = useUpdateExpenseCategory();
  const qc = useQueryClient();

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Cuenta del doctor</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">
          Le corresponde = % de lo cobrado en los tratamientos que tienen a ese doctor asignado. Pagado = egresos con su nombre en categorías marcadas “Pago a doctor”.
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !data ? null : (
        <div className="text-xs">
          {data.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">No hay cobros con doctor asignado en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                    <th className="px-4 py-2 font-medium">Doctor</th>
                    <th className="px-4 py-2 font-medium">Porcentaje</th>
                    <th className="px-4 py-2 font-medium text-right">Cobrado</th>
                    <th className="px-4 py-2 font-medium text-right">Le corresponde</th>
                    <th className="px-4 py-2 font-medium text-right">Pagado</th>
                    <th className="px-4 py-2 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.doctor_id} className="border-b border-slate-50 dark:border-gray-700/50">
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                        {r.doctor_name}
                        <span className="block text-[10px] font-normal text-slate-400">{r.n_cobros} cobros</span>
                      </td>
                      <td className="px-4 py-2.5"><PctInput key={`${r.doctor_id}-${r.pct}`} doctorId={r.doctor_id} pct={r.pct} /></td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{fmt(r.cobrado)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{r.corresponde != null ? fmt(r.corresponde) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">
                        {fmt(r.pagado)}
                        {r.otros_pagos > 0 && <span className="block text-[10px] text-slate-400">+ {fmt(r.otros_pagos)} otros pagos (asistencia…)</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${r.saldo == null ? "text-slate-300" : r.saldo > 0 ? "text-amber-600 dark:text-amber-400" : r.saldo < 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {r.saldo == null ? "—" : r.saldo > 0 ? `Se le debe ${fmt(r.saldo)}` : r.saldo < 0 ? `Pagado de más ${fmt(-r.saldo)}` : "Al día"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details className="border-t border-slate-100 dark:border-gray-700 px-4 py-2.5" open={!data.has_payment_categories}>
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-gray-300">
              Categorías que cuentan como “Pago a doctor”{!data.has_payment_categories && " — marca al menos una"}
            </summary>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {data.categories.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox" checked={c.is_doctor_payment}
                    onChange={(e) => updateCat.mutate(
                      { id: c.id, is_doctor_payment: e.target.checked },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: ["report-doctor-account"] }) },
                    )}
                    className="rounded border-slate-300 dark:border-gray-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </details>

          <details className="border-t border-slate-100 dark:border-gray-700 px-4 py-2.5">
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-gray-300">
              Cobros sin doctor asignado: {data.cobros_sin_doctor.n} ({fmt(data.cobros_sin_doctor.total)})
            </summary>
            {data.cobros_sin_doctor.n === 0 ? (
              <p className="mt-2 text-slate-400">Todos los cobros tienen doctor asignado.</p>
            ) : (
              <>
                <table className="mt-2 w-full">
                  <tbody>
                    {data.cobros_sin_doctor.items.map((i) => (
                      <tr key={i.id} className="border-b border-slate-50 dark:border-gray-700/50 text-slate-600 dark:text-gray-300">
                        <td className="py-1 whitespace-nowrap">{fmtDate(i.date)}</td>
                        <td className="py-1 px-2">{i.patient_name ?? "—"}</td>
                        <td className="py-1 px-2 text-slate-400">{i.treatment_name ?? "—"}</td>
                        <td className="py-1 text-right">{fmt(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.cobros_sin_doctor.n > data.cobros_sin_doctor.items.length && (
                  <p className="mt-1 text-[11px] text-slate-400">Se muestran los {data.cobros_sin_doctor.items.length} más recientes.</p>
                )}
                <Link href="/finances" className="mt-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                  Corregir en Finanzas (editar la transacción y elegir doctor) <ExternalLink size={10} />
                </Link>
              </>
            )}
          </details>

          <details className="border-t border-slate-100 dark:border-gray-700 px-4 py-2.5">
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-gray-300">
              Pagos al personal sin doctor marcado: {data.pagos_sin_doctor.n} ({fmt(data.pagos_sin_doctor.total)})
            </summary>
            {data.pagos_sin_doctor.n === 0 ? (
              <p className="mt-2 text-slate-400">No hay pagos pendientes de revisar.</p>
            ) : (
              <>
                <p className="mt-2 text-[11px] text-slate-400">Egresos en categorías “Pago a doctor” o “Salario / Honorarios” sin doctor. Edítalos y elige a quién se le pagó para que cuenten en su cuenta.</p>
                <table className="mt-1 w-full">
                  <tbody>
                    {data.pagos_sin_doctor.items.map((i) => (
                      <tr key={i.id} className="border-b border-slate-50 dark:border-gray-700/50 text-slate-600 dark:text-gray-300">
                        <td className="py-1 whitespace-nowrap">{fmtDate(i.date)}</td>
                        <td className="py-1 px-2 text-slate-400">{i.category}</td>
                        <td className="py-1 px-2">{i.description}</td>
                        <td className="py-1 text-right">{fmt(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Link href="/finances" className="mt-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                  Corregir en Finanzas <ExternalLink size={10} />
                </Link>
              </>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
