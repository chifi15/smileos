"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Moon,
  ChevronDown,
  ChevronUp,
  Phone,
  X,
  Calendar,
  ExternalLink,
  FileText,
  Stethoscope,
} from "lucide-react";
import {
  usePatientSegments,
  usePatientVisitHistory,
  PatientSegmentItem,
  VisitHistoryItem,
} from "@/hooks/usePatients";
import Spinner from "@/components/ui/Spinner";

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

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  primera_consulta: "Primera consulta",
  control: "Control",
  limpieza: "Limpieza",
  extraccion: "Extracción",
  endodoncia: "Endodoncia",
  ortodoncia: "Ortodoncia",
  protesis: "Prótesis",
  cirugia: "Cirugía",
  emergencia: "Emergencia",
  otro: "Otro",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: "Completada", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  confirmed: { label: "Confirmada", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "En curso", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  no_show: { label: "No asistió", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Sin visitas registradas";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return "—";
  }
}

// ─── Modal de historial de visitas ────────────────────────────────────────────

function VisitCard({ visit, isFirst }: { visit: VisitHistoryItem; isFirst: boolean }) {
  const [open, setOpen] = useState(isFirst);
  const status = STATUS_LABELS[visit.status] ?? { label: visit.status, color: "bg-slate-100 text-slate-600" };
  const typeLabel = APPOINTMENT_TYPE_LABELS[visit.type] ?? visit.type;
  const hasDetail = visit.reason || visit.notes || visit.procedures.length > 0 || visit.evolutions.length > 0;

  return (
    <div className={`rounded-lg border ${isFirst ? "border-blue-300 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-900/10" : "border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 shrink-0">
            {visit.source === "calendar"
              ? <Calendar size={15} className="text-slate-400 dark:text-gray-500" />
              : <Stethoscope size={15} className="text-slate-500 dark:text-gray-400" />}
          </div>
          <div className="min-w-0">
            {isFirst && (
              <span className="inline-block mb-1 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Última visita
              </span>
            )}
            <p className="text-sm font-medium text-slate-800 dark:text-white">{typeLabel}</p>
            <p className="text-xs text-slate-400 dark:text-gray-500">{fmtDate(visit.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${status.color}`}>
            {status.label}
          </span>
          {hasDetail && (
            open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
          )}
        </div>
      </button>

      {open && hasDetail && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-gray-700 pt-3">
          {visit.reason && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-0.5">Motivo / Procedimiento</p>
              <p className="text-sm text-slate-700 dark:text-gray-300">{visit.reason}</p>
            </div>
          )}
          {visit.notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-0.5">Notas</p>
              <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line">{visit.notes}</p>
            </div>
          )}
          {visit.procedures.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-1">Procedimientos cobrados</p>
              <ul className="space-y-1">
                {visit.procedures.map((proc, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-slate-700 dark:text-gray-300">{proc.procedure_name}</span>
                    <span className="shrink-0 text-green-600 dark:text-green-400 font-medium">
                      C${proc.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {visit.evolutions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-0.5">Evolución clínica</p>
              {visit.evolutions.map((note, i) => (
                <p key={i} className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line">{note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VisitHistoryModal({
  patient,
  onClose,
}: {
  patient: PatientSegmentItem;
  onClose: () => void;
}) {
  const { data, isLoading } = usePatientVisitHistory(patient.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">{patient.full_name}</h2>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              {isLoading
                ? "Cargando historial…"
                : data
                ? `${data.total_visits} visita${data.total_visits !== 1 ? "s" : ""} · Última ${fmtRelative(data.last_visit)}`
                : "Sin historial"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/patients/${patient.id}`}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink size={12} />
              Ver perfil
            </Link>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !data || data.visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <FileText size={32} className="text-slate-300 dark:text-gray-600" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Este paciente no tiene visitas registradas</p>
            </div>
          ) : (
            data.visits.map((visit, i) => (
              <VisitCard key={visit.id} visit={visit} isFirst={i === 0} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SegmentCard ──────────────────────────────────────────────────────────────

interface SegmentCardProps {
  label: string;
  description: string;
  count: number;
  patients: PatientSegmentItem[];
  color: "red" | "yellow" | "slate";
  icon: React.ReactNode;
  defaultOpen?: boolean;
  onPatientClick: (p: PatientSegmentItem) => void;
}

function lastSeenLabel(patient: PatientSegmentItem): string {
  const raw = patient.last_visit ?? patient.first_visit_date;
  if (!raw) return "Sin visitas registradas";
  try {
    return "Última visita: " + formatDistanceToNow(parseISO(raw), { addSuffix: true, locale: es });
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
  onPatientClick,
}: SegmentCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const c = COLOR_MAP[color];

  return (
    <div className={`rounded-xl border ${c.card} bg-white dark:bg-gray-800 overflow-hidden shadow-sm`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 ${c.header} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className={c.icon}>{icon}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-white text-sm">{label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{count}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <span className="text-slate-400 dark:text-gray-500 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

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
                onClick={() => onPatientClick(p)}
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
                    <p className="text-xs text-slate-400 dark:text-gray-500">{lastSeenLabel(p)}</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientSegmentsPage() {
  const { data, isLoading } = usePatientSegments();
  const [selectedPatient, setSelectedPatient] = useState<PatientSegmentItem | null>(null);

  const total = data
    ? data.incomplete_treatment.count + data.pending_review.count + data.dormant.count
    : 0;

  return (
    <>
      <div className="p-6 space-y-5 max-w-3xl mx-auto">
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
                {total} pacientes requieren atención · Haz clic en un paciente para ver su historial
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
              onPatientClick={setSelectedPatient}
            />
            <SegmentCard
              label="Revisión pendiente"
              description="Sin visita en los últimos 6 a 12 meses"
              count={data!.pending_review.count}
              patients={data!.pending_review.patients}
              color="yellow"
              icon={<Clock size={20} />}
              onPatientClick={setSelectedPatient}
            />
            <SegmentCard
              label="Paciente dormido"
              description="Sin visita en más de 12 meses o sin historial de visitas"
              count={data!.dormant.count}
              patients={data!.dormant.patients}
              color="slate"
              icon={<Moon size={20} />}
              onPatientClick={setSelectedPatient}
            />
          </div>
        )}
      </div>

      {selectedPatient && (
        <VisitHistoryModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </>
  );
}
