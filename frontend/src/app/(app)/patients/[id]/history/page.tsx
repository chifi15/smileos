"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import { usePatientAudit } from "@/hooks/useAudit";
import Spinner from "@/components/ui/Spinner";
import type { AuditLog } from "@/types";

const RESOURCE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700",
  appointment: "bg-purple-100 text-purple-700",
  treatment_plan: "bg-indigo-100 text-indigo-700",
  treatment_item: "bg-cyan-100 text-cyan-700",
  odontogram: "bg-teal-100 text-teal-700",
  evolution: "bg-emerald-100 text-emerald-700",
  finance: "bg-green-100 text-green-700",
  reward: "bg-amber-100 text-amber-700",
  photo: "bg-pink-100 text-pink-700",
  settings: "bg-slate-100 text-slate-600",
  user: "bg-orange-100 text-orange-700",
};

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "Todo" },
  { value: "patient", label: "Datos" },
  { value: "appointment", label: "Citas" },
  { value: "treatment_plan", label: "Planes" },
  { value: "treatment_item", label: "Tratamientos" },
  { value: "odontogram", label: "Odontograma" },
  { value: "evolution", label: "Evoluciones" },
  { value: "finance", label: "Finanzas" },
  { value: "reward", label: "Rewards" },
  { value: "photo", label: "Fotos" },
];

function AuditEntry({ entry }: { entry: AuditLog }) {
  const color = RESOURCE_COLORS[entry.resource_type] ?? "bg-slate-100 text-slate-600";
  const date = parseISO(entry.created_at);

  return (
    <div className="flex items-start gap-3 py-3">
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
          <span>{format(date, "d MMM yyyy, HH:mm", { locale: es })}</span>
        </div>
      </div>
    </div>
  );
}

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);

  const { data: patient, isLoading: loadingPatient } = usePatient(id);
  const { data, isLoading } = usePatientAudit(id, {
    resource_type: resourceType || undefined,
    page,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/patients/${id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={16} />
          {loadingPatient ? "Paciente" : patient?.full_name}
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <History size={20} className="text-slate-400 dark:text-gray-500" />
          Historial de cambios
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
          Todos los cambios registrados para este paciente
        </p>
      </div>

      {/* Filter chips */}
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

      {/* Feed */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">
            No hay cambios registrados para este paciente
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700 px-5">
            {entries.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-700 px-5 py-3">
            <span className="text-xs text-slate-400 dark:text-gray-500">
              {meta.total} registro{meta.total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-600 dark:text-gray-400">
                {page} / {meta.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page === meta.pages}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
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
