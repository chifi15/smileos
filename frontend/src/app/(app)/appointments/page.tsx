"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useAppointments } from "@/hooks/useAppointments";
import { useClinicUsers } from "@/hooks/useUsers";
import { AppointmentFull } from "@/types";
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

  const { data: appointments = [] } = useAppointments(range.from, range.to);
  const { data: users = [] } = useClinicUsers();

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
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Agenda</h1>
          {filteredAppointments.length > 0 && (
            <p className="text-sm text-slate-500">
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
          <Button onClick={() => setNewApptDateStr(format(new Date(), "yyyy-MM-dd") + "T09:00:00")}>
            <CalendarPlus size={16} />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-slate-100">
        {[
          { color: "bg-slate-400", label: "Programada" },
          { color: "bg-blue-500", label: "Confirmada" },
          { color: "bg-amber-400", label: "En progreso" },
          { color: "bg-green-500", label: "Completada" },
          { color: "bg-rose-500", label: "No asistió" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-6">
        <AppointmentCalendar
          appointments={filteredAppointments}
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
    </div>
  );
}
