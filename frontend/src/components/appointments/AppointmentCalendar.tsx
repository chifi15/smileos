"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import { AppointmentFull, AppointmentStatus } from "@/types";

const STATUS_BG: Record<AppointmentStatus, string> = {
  scheduled: "#94a3b8",
  confirmed: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#cbd5e1",
  no_show: "#f43f5e",
};

interface Props {
  appointments: AppointmentFull[];
  onEventClick: (appt: AppointmentFull) => void;
  onDateClick: (dateStr: string) => void;
  onDatesSet: (dateFrom: string, dateTo: string) => void;
}

function EventContent({ arg }: { arg: EventContentArg }) {
  const appt = arg.event.extendedProps as AppointmentFull;
  return (
    <div className="h-full overflow-hidden px-1.5 py-1 leading-tight">
      <p className="truncate text-xs font-semibold">{appt.patient_name}</p>
      <p className="truncate text-[10px] opacity-80">
        {arg.timeText}
      </p>
    </div>
  );
}

export default function AppointmentCalendar({
  appointments,
  onEventClick,
  onDateClick,
  onDatesSet,
}: Props) {
  const events = appointments.map((appt) => {
    const bg = STATUS_BG[appt.status as AppointmentStatus] ?? "#94a3b8";
    return {
      id: appt.id,
      title: appt.patient_name,
      start: appt.scheduled_at,
      end: appt.end_at,
      backgroundColor: bg,
      borderColor: bg,
      extendedProps: appt,
    };
  });

  return (
    <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-semibold [&_.fc-button]:text-sm [&_.fc-button]:capitalize [&_.fc-button-primary]:bg-blue-600 [&_.fc-button-primary]:border-blue-600 [&_.fc-button-primary:not(.fc-button-active)]:bg-white [&_.fc-button-primary:not(.fc-button-active)]:text-slate-700 [&_.fc-button-primary:not(.fc-button-active)]:border-slate-300 [&_.fc-today-button]:bg-white [&_.fc-today-button]:text-slate-700 [&_.fc-today-button]:border-slate-300 [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-md">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,timeGridDay",
        }}
        locale={esLocale}
        timeZone="local"
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        nowIndicator
        height="calc(100vh - 200px)"
        events={events}
        eventClick={(arg: EventClickArg) => {
          onEventClick(arg.event.extendedProps as AppointmentFull);
        }}
        dateClick={(arg) => {
          onDateClick(arg.dateStr);
        }}
        datesSet={(arg: DatesSetArg) => {
          onDatesSet(arg.startStr.slice(0, 10), arg.endStr.slice(0, 10));
        }}
        eventContent={(arg: EventContentArg) => <EventContent arg={arg} />}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          startTime: "08:00",
          endTime: "18:00",
        }}
      />
    </div>
  );
}
