"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useAuditFeed } from "@/hooks/useAudit";
import Spinner from "@/components/ui/Spinner";
import type { AuditLog } from "@/types";

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "patient", label: "Pacientes" },
  { value: "appointment", label: "Citas" },
  { value: "treatment_plan", label: "Planes de tratamiento" },
  { value: "treatment_item", label: "Tratamientos" },
  { value: "odontogram", label: "Odontograma" },
  { value: "evolution", label: "Evoluciones" },
  { value: "finance", label: "Finanzas" },
  { value: "reward", label: "Smile Rewards" },
  { value: "photo", label: "Fotografías" },
  { value: "settings", label: "Configuración" },
  { value: "user", label: "Usuarios" },
  { value: "cost_treatment", label: "Costos operativos" },
  { value: "cost_product", label: "Productos" },
  { value: "cost_product_lot", label: "Lotes" },
  { value: "fixed_costs", label: "Costos fijos" },
];

const RESOURCE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  appointment: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  treatment_plan: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  treatment_item: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  odontogram: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  evolution: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  finance: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  reward: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  photo: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  settings: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  user: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  cost_treatment: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  cost_product: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  cost_product_lot: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  fixed_costs: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
};

function AuditEntry({ entry }: { entry: AuditLog }) {
  const color = RESOURCE_COLORS[entry.resource_type] ?? "bg-slate-100 text-slate-600";
  const date = parseISO(entry.created_at);

  return (
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
      <div className="mt-0.5 shrink-0">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
          {entry.resource_type_label}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 dark:text-white">{entry.description ?? entry.action}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
          {entry.user && <span>{entry.user.full_name}</span>}
          {entry.user && <span>·</span>}
          <span title={format(date, "PPpp", { locale: es })}>
            {format(date, "d MMM yyyy, HH:mm", { locale: es })}
          </span>
          {entry.patient_id && (
            <>
              <span>·</span>
              <Link
                href={`/patients/${entry.patient_id}`}
                className="text-blue-500 hover:underline"
              >
                Ver paciente
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActividadPage() {
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditFeed({
    resource_type: resourceType || undefined,
    page,
    per_page: 30,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Activity size={20} className="text-slate-500 dark:text-gray-500" />
          Actividad reciente
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
          Historial de todos los cambios en el sistema
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
        <div className="flex flex-wrap gap-2">
          {RESOURCE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setResourceType(opt.value); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                resourceType === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-gray-500">
            No hay actividad registrada
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {entries.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-700 px-5 py-3">
            <span className="text-xs text-slate-400 dark:text-gray-500">
              {meta.total} registro{meta.total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-600 dark:text-gray-400">
                {page} / {meta.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page === meta.pages}
                className="rounded p-1 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
