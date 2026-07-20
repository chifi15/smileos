"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, CalendarDays, Plus } from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import { usePatientAppointments } from "@/hooks/useAppointments";
import {
  AppointmentFull,
  AppointmentStatus,
  AppointmentType,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_TYPE_LABELS,
} from "@/types";
import AppointmentDetailModal from "@/components/appointments/AppointmentDetailModal";
import NewAppointmentModal from "@/components/appointments/NewAppointmentModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export default function PatientAppointmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: appointments = [], isLoading } = usePatientAppointments(id);
  const [selected, setSelected] = useState<AppointmentFull | null>(null);
  const [newApptDate, setNewApptDate] = useState<string | null>(null);

  const upcoming = appointments.filter((a) =>
    ["scheduled", "confirmed", "in_progress"].includes(a.status)
  );
  const past = appointments.filter(
    (a) => !["scheduled", "confirmed", "in_progress"].includes(a.status)
  );

  function AppointmentRow({ appt }: { appt: AppointmentFull }) {
    const status = appt.status as AppointmentStatus;
    const localDate = parseISO(appt.scheduled_at);
    const dateStr = format(localDate, "d MMM yyyy", { locale: es });
    const timeStr = format(localDate, "HH:mm");

    return (
      <button
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setSelected(appt)}
      >
        <div className="w-24 shrink-0">
          <p className="text-sm font-medium text-slate-700">{dateStr}</p>
          <p className="text-xs text-slate-400">{timeStr} · {appt.duration_minutes} min</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {APPOINTMENT_TYPE_LABELS[appt.appointment_type as AppointmentType]}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {appt.dentist_name}
            {appt.reason && ` — ${appt.reason}`}
          </p>
        </div>
        <Badge
          label={APPOINTMENT_STATUS_LABELS[status]}
          className={cn(APPOINTMENT_STATUS_COLORS[status], "shrink-0")}
        />
      </button>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">Historial de citas</h1>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setNewApptDate(format(new Date(), "yyyy-MM-dd") + "T09:00:00")
          }
        >
          <Plus size={15} />
          Nueva cita
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
          <CalendarDays size={40} className="text-slate-300" />
          <p className="text-sm text-slate-400">No hay citas registradas para este paciente.</p>
          <Link
            href="/appointments"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Ir a la agenda
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Próximas · {upcoming.length}
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {upcoming
                  .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
                  .map((a) => (
                    <AppointmentRow key={a.id} appt={a} />
                  ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Historial · {past.length}
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {past
                  .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
                  .map((a) => (
                    <AppointmentRow key={a.id} appt={a} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AppointmentDetailModal
        appointment={selected}
        onClose={() => setSelected(null)}
      />
      <NewAppointmentModal
        dateStr={newApptDate}
        onClose={() => setNewApptDate(null)}
        prefilledPatient={
          patient ? { id, name: patient.full_name } : undefined
        }
      />
    </div>
  );
}
