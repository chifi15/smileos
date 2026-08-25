"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Moon,
  ChevronDown,
  ChevronUp,
  Phone,
} from "lucide-react";
import { usePatientSegments, PatientSegmentItem } from "@/hooks/usePatients";
import Spinner from "@/components/ui/Spinner";

interface SegmentCardProps {
  label: string;
  description: string;
  count: number;
  patients: PatientSegmentItem[];
  color: "red" | "yellow" | "slate";
  icon: React.ReactNode;
  defaultOpen?: boolean;
}

const COLOR_MAP = {
  red: {
    card: "border-red-200 dark:border-red-800",
    header: "bg-red-50 dark:bg-red-900/20",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    icon: "text-red-500 dark:text-red-400",
    dot: "bg-red-500",
    row: "hover:bg-red-50/50 dark:hover:bg-red-900/10",
  },
  yellow: {
    card: "border-amber-200 dark:border-amber-800",
    header: "bg-amber-50 dark:bg-amber-900/20",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    icon: "text-amber-500 dark:text-amber-400",
    dot: "bg-amber-400",
    row: "hover:bg-amber-50/50 dark:hover:bg-amber-900/10",
  },
  slate: {
    card: "border-slate-200 dark:border-slate-700",
    header: "bg-slate-50 dark:bg-slate-800/50",
    badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
    icon: "text-slate-400 dark:text-slate-500",
    dot: "bg-slate-400",
    row: "hover:bg-slate-50/50 dark:hover:bg-slate-700/20",
  },
};

function lastSeenLabel(patient: PatientSegmentItem): string {
  const raw = patient.last_visit ?? patient.first_visit_date;
  if (!raw) return "Sin visitas registradas";
  try {
    return (
      "Última visita: " +
      formatDistanceToNow(parseISO(raw), { addSuffix: true, locale: es })
    );
  } catch {
    return "—";
  }
}

function SegmentCard({
  label,
  description,
  count,
  patients,
  color,
  icon,
  defaultOpen = false,
}: SegmentCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const c = COLOR_MAP[color];

  return (
    <div className={`rounded-xl border ${c.card} bg-white dark:bg-gray-800 overflow-hidden shadow-sm`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 ${c.header} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className={c.icon}>{icon}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-white text-sm">
                {label}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                {count}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <span className="text-slate-400 dark:text-gray-500 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Patient list */}
      {open && (
        <div className="divide-y divide-slate-50 dark:divide-gray-700">
          {patients.length === 0 ? (
            <p className="px-5 py-6 text-sm text-center text-slate-400 dark:text-gray-500">
              No hay pacientes en esta categoría.
            </p>
          ) : (
            patients.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${c.row}`}
                onClick={() => router.push(`/patients/${p.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                        {p.full_name}
                      </span>
                      {p.patient_number && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 shrink-0">
                          #{String(p.patient_number).padStart(3, "0")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-gray-500">
                      {lastSeenLabel(p)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {p.phone && (
                    <a
                      href={`tel:${p.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Phone size={12} />
                      {p.phone}
                    </a>
                  )}
                  <Link
                    href={`/patients/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientSegmentsPage() {
  const { data, isLoading } = usePatientSegments();

  const total = data
    ? data.incomplete_treatment.count + data.pending_review.count + data.dormant.count
    : 0;

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/patients"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
            Segmentación de pacientes
          </h1>
          {!isLoading && (
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {total} pacientes requieren atención
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <SegmentCard
            label="Tratamiento incompleto"
            description="Tienen un plan activo con procedimientos pendientes"
            count={data!.incomplete_treatment.count}
            patients={data!.incomplete_treatment.patients}
            color="red"
            icon={<AlertCircle size={20} />}
            defaultOpen={true}
          />
          <SegmentCard
            label="Revisión pendiente"
            description="Sin visita en los últimos 6 a 12 meses"
            count={data!.pending_review.count}
            patients={data!.pending_review.patients}
            color="yellow"
            icon={<Clock size={20} />}
          />
          <SegmentCard
            label="Paciente dormido"
            description="Sin visita en más de 12 meses o sin historial de visitas"
            count={data!.dormant.count}
            patients={data!.dormant.patients}
            color="slate"
            icon={<Moon size={20} />}
          />
        </div>
      )}
    </div>
  );
}
