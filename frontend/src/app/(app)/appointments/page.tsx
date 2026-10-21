"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarPlus, RefreshCw, Trash2, RotateCcw, X, Link2, Check } from "lucide-react";
import { useAppointments, useDeletedAppointments, useRestoreAppointment } from "@/hooks/useAppointments";
import { useClinicUsers } from "@/hooks/useUsers";
import { useCalendarEvents, useSyncCalendar, useCalendarStatus } from "@/hooks/useCalendar";
import { AppointmentFull } from "@/types";
import { useAuthStore } from "@/stores/auth.store";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import AppointmentDetailModal from "@/components/appointments/AppointmentDetailModal";
import NewAppointmentModal from "@/components/appointments/NewAppointmentModal";

const AppointmentCalendar = dynamic(
  () => import("@/components/appointments/AppointmentCalendar"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    ),
  }
);

function currentWeekRange() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + (dow === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: format(monday, "yyyy-MM-dd"),
    to: format(sunday, "yyyy-MM-dd"),
  };
}

export default function AppointmentsPage() {
  const [range, setRange] = useState(currentWeekRange);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentFull | null>(null);
  const [newApptDateStr, setNewApptDateStr] = useState<string | null>(null);
  const [dentistFilter, setDentistFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [copied, setCopied] = useState(false);
  const user = useAuthStore((s) => s.user);

  function copyBookingLink() {
    if (!user?.clinic_slug) return;
    const url = `${window.location.origin}/reservar/${user.clinic_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  const { data: deletedAppts = [] } = useDeletedAppointments();
  const restore = useRestoreAppointment();

  const { data: appointments = [] } = useAppointments(range.from, range.to);
  const { data: users = [] } = useClinicUsers();
  const { data: calendarStatus } = useCalendarStatus();
  const { data: gcalEvents = [] } = useCalendarEvents(range.from, range.to, calendarStatus?.configured ?? false);
  const syncCalendar = useSyncCalendar();

  const filteredAppointments =
    dentistFilter === "all"
      ? appointments
      : appointments.filter((a) => a.dentist_id === dentistFilter);

  const dentistOptions = [
    { value: "all", label: "Todos los dentistas" },
    ...users.map((u) => ({ value: u.id, label: u.full_name })),
  ];

  const statusCounts = filteredAppointments.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Agenda</h1>
          {filteredAppointments.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {filteredAppointments.length} citas en vista
              {statusCounts.completed ? ` · ${statusCounts.completed} completadas` : ""}
              {statusCounts.in_progress ? ` · ${statusCounts.in_progress} en progreso` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {users.length > 1 && (
            <Select
              value={dentistFilter}
              onChange={(e) => setDentistFilter(e.target.value)}
              options={dentistOptions}
              className="w-52 text-sm"
            />
          )}
          {calendarStatus?.configured && (
            <Button
              variant="secondary"
              onClick={() => syncCalendar.mutate()}
              loading={syncCalendar.isPending}
              title="Sincronizar Google Calendar"
            >
              <RefreshCw size={15} />
              Google Calendar
            </Button>
          )}
          <button
            onClick={copyBookingLink}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 text-sm font-medium transition-colors text-slate-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400"
            title="Copiar enlace de reserva para pacientes"
          >
            {copied ? <Check size={15} className="text-green-500" /> : <Link2 size={15} />}
            {copied ? "¡Copiado!" : "Enlace de reserva"}
          </button>
          <button
            onClick={() => setShowTrash(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-slate-500 dark:text-gray-400 hover:border-slate-300 transition-colors"
            title="Ver citas eliminadas"
          >
            <Trash2 size={15} />
            {deletedAppts.length > 0 && <span className="text-xs">({deletedAppts.length})</span>}
          </button>
          <Button onClick={() => setNewApptDateStr(format(new Date(), "yyyy-MM-dd") + "T09:00:00")}>
            <CalendarPlus size={16} />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
        {[
          { color: "bg-slate-400", label: "Programada" },
          { color: "bg-blue-500", label: "Confirmada" },
          { color: "bg-amber-400", label: "En progreso" },
          { color: "bg-green-500", label: "Completada" },
          { color: "bg-rose-500", label: "No asistió" },
          ...(calendarStatus?.configured ? [{ color: "bg-violet-500", label: "Google Calendar" }] : []),
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-xs text-slate-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-6">
        <AppointmentCalendar
          appointments={filteredAppointments}
          calendarEvents={gcalEvents}
          onEventClick={setSelectedAppt}
          onDateClick={setNewApptDateStr}
          onDatesSet={(from, to) => setRange({ from, to })}
        />
      </div>

      {/* Modals */}
      <AppointmentDetailModal
        appointment={selectedAppt}
        onClose={() => setSelectedAppt(null)}
      />
      <NewAppointmentModal
        dateStr={newApptDateStr}
        onClose={() => setNewApptDateStr(null)}
      />

      {/* Papelera modal */}
      {showTrash && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
              <h3 className="font-semibold text-slate-800 dark:text-white">Citas eliminadas</h3>
              <button onClick={() => setShowTrash(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {deletedAppts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <Trash2 size={36} strokeWidth={1.2} />
                  <p className="text-sm">No hay citas eliminadas.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {deletedAppts.map((appt) => (
                    <div key={appt.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{appt.patient_name || "Sin paciente"}</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                          {format(parseISO(appt.scheduled_at), "dd/MM/yyyy HH:mm")} · {appt.dentist_name}
                        </p>
                      </div>
                      <button
                        onClick={() => restore.mutate(appt.id, { onSuccess: () => {} })}
                        disabled={restore.isPending}
                        className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
