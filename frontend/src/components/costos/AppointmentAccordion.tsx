"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { AppointmentCostDetail } from "@/types/costos";
import { fmtC } from "@/lib/costos-utils";
import { categoryLabel, categoryColor } from "@/types/costos";

interface Props {
  detail: AppointmentCostDetail;
  defaultOpen?: boolean;
}

export default function AppointmentAccordion({ detail, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const { appointment, materialCost, materials } = detail;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            {appointment.number}
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">{appointment.name}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">{materials.length} materiales</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-gray-400">Costo cita</p>
            <p className="font-semibold text-slate-800 dark:text-white">{fmtC(materialCost)}</p>
          </div>
          {open ? (
            <ChevronDown size={16} className="text-slate-400 dark:text-gray-500 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 dark:text-gray-500 shrink-0" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-100 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                <th className="px-5 py-2.5 text-left font-medium">Material / Insumo</th>
                <th className="px-5 py-2.5 text-left font-medium">Categoría</th>
                <th className="px-4 py-2.5 text-right font-medium">Precio unitario</th>
                <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
              {materials.map(({ product, quantity, total }) => (
                <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Package size={13} className="text-slate-400 dark:text-gray-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-gray-300">{product.name}</span>
                    </div>
                    {product.portionDescription && (
                      <p className="mt-0.5 pl-5 text-xs text-slate-400 dark:text-gray-500">
                        por {product.portionDescription}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(product.category)}`}
                    >
                      {categoryLabel(product.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-400">{fmtC(product.unitPrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-gray-400">{quantity}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800 dark:text-white">
                    {fmtC(total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50">
                <td colSpan={4} className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-gray-400">
                  Total materiales — Cita {appointment.number}
                </td>
                <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-white">
                  {fmtC(materialCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
