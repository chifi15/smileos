"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { useDrilldown, type DrilldownKind } from "@/hooks/useReports";

export interface DrilldownSelection {
  kind: DrilldownKind;
  key: string;
  title: string;
  year: number;
  month: number | null;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-NI", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function DrilldownModal({
  selected,
  onClose,
}: {
  selected: DrilldownSelection;
  onClose: () => void;
}) {
  const { data, isLoading } = useDrilldown(selected.kind, selected.key, selected.year, selected.month);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const isExpense = selected.kind === "expense";
  const period = selected.month ? `${MONTHS[selected.month - 1]} ${selected.year}` : `Año ${selected.year}`;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Columnas que ya son el tema del detalle se omiten
  const showDoctor = selected.kind !== "doctor";
  const showPatient = selected.kind !== "patient";
  const showTreatment = selected.kind !== "treatment" && !isExpense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{selected.title}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              {period} · {isExpense ? "Gastos" : "Ingresos"} y de dónde salen
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !data || data.rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400 dark:text-gray-500">Sin transacciones en este período.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  {showPatient && <th className="px-4 py-2.5 font-medium">Paciente</th>}
                  {showTreatment && <th className="px-4 py-2.5 font-medium">Tratamiento</th>}
                  {isExpense && <th className="px-4 py-2.5 font-medium">Descripción</th>}
                  {showDoctor && !isExpense && <th className="px-4 py-2.5 font-medium">Doctor</th>}
                  {!isExpense && <th className="px-4 py-2.5 font-medium text-right">Costo op.</th>}
                  <th className="px-4 py-2.5 font-medium text-right">{isExpense ? "Monto" : "Ingreso"}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const expandable = !isExpense && (r.materials.length > 0 || r.op_cost > 0);
                  const isOpen = open.has(r.id);
                  const materialsTotal = r.materials.reduce((s, m) => s + m.total_cost, 0);
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={expandable ? () => toggle(r.id) : undefined}
                        className={`border-b border-slate-50 dark:border-gray-700/50 ${expandable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/30" : ""}`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-gray-300">{fmtDate(r.date)}</td>
                        {showPatient && (
                          <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                            {r.patient_id ? (
                              <Link
                                href={`/patients/${r.patient_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                {r.patient_name ?? "—"} <ExternalLink size={10} />
                              </Link>
                            ) : (r.patient_name ?? "—")}
                          </td>
                        )}
                        {showTreatment && (
                          <td className="px-4 py-2.5 text-slate-600 dark:text-gray-300">
                            {r.treatment_name ?? "—"}{r.quantity > 1 ? ` ×${r.quantity}` : ""}
                          </td>
                        )}
                        {isExpense && <td className="px-4 py-2.5 text-slate-600 dark:text-gray-300">{r.description}</td>}
                        {showDoctor && !isExpense && (
                          <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400">{r.doctor_name ?? "—"}</td>
                        )}
                        {!isExpense && (
                          <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400">
                            <span className="inline-flex items-center gap-1">
                              {fmt(r.op_cost)}
                              {expandable && (isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </span>
                          </td>
                        )}
                        <td className={`px-4 py-2.5 text-right font-semibold ${isExpense ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {fmt(r.amount)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/70 dark:bg-gray-700/20">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-gray-400">
                              Costo operativo: {fmt(r.op_cost)}
                              {r.materials.length > 0 && ` (materiales: ${fmt(materialsTotal)}; el resto son honorarios y costos fijos)`}
                            </p>
                            {r.materials.length > 0 ? (
                              <table className="w-full max-w-lg text-[11px]">
                                <thead>
                                  <tr className="text-left text-slate-400 dark:text-gray-500">
                                    <th className="py-1 font-medium">Material</th>
                                    <th className="py-1 font-medium text-right">Unidades</th>
                                    <th className="py-1 font-medium text-right">Precio unit.</th>
                                    <th className="py-1 font-medium text-right">Costo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.materials.map((m, i) => (
                                    <tr key={i} className="text-slate-600 dark:text-gray-300">
                                      <td className="py-0.5">{m.name}</td>
                                      <td className="py-0.5 text-right">{m.units}</td>
                                      <td className="py-0.5 text-right text-slate-400">{fmt(m.unit_price)}</td>
                                      <td className="py-0.5 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(m.total_cost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-[11px] text-slate-400 dark:text-gray-500">Sin materiales registrados en esta transacción.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data && data.rows.length > 0 && (
          <div className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40 px-4 py-2.5 flex flex-wrap gap-4 text-xs">
            <span className="text-slate-500 dark:text-gray-400">{data.rows.length} transacciones{data.truncated ? " (se muestran las 500 más recientes)" : ""}</span>
            {!isExpense && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Costos op.: {fmt(data.total_op_cost)}</span>
            )}
            <span className={`font-semibold ${isExpense ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              Total: {fmt(data.total_amount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
