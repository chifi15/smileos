"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import { AppointmentFull, AppointmentStatus } from "@/types";
import { CalendarEvent } from "@/hooks/useCalendar";

const STATUS_BG: Record<AppointmentStatus, string> = {
  scheduled: "#94a3b8",
  confirmed: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#cbd5e1",
  no_show: "#f43f5e",
};

const GCAL_COLOR_HEX: Record<string, string> = {
  "1": "#D50000", "2": "#E67C73", "3": "#F4511E", "4": "#F6BF26",
  "5": "#33B679", "6": "#0B8043", "7": "#039BE5", "8": "#3F51B5",
  "9": "#7986CB", "10": "#8E24AA", "11": "#616161",
};

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1e293b" : "#ffffff";
}

interface Props {
  appointments: AppointmentFull[];
  calendarEvents?: CalendarEvent[];
  onEventClick: (appt: AppointmentFull) => void;
  onDateClick: (dateStr: string) => void;
  onDatesSet: (dateFrom: string, dateTo: string) => void;
}

function EventContent({ arg }: { arg: EventContentArg }) {
  const isGcal = arg.event.extendedProps._source === "gcal";
  const title = isGcal ? arg.event.title : (arg.event.extendedProps as AppointmentFull).patient_name;
  return (
    <div className="h-full overflow-hidden px-1.5 py-1 leading-tight">
      <p className="truncate text-xs font-semibold">{title}</p>
      <p className="truncate text-[10px] opacity-80">
        {isGcal ? "📅 Google" : arg.timeText}
      </p>
    </div>
  );
}

export default function AppointmentCalendar({
  appointments,
  calendarEvents = [],
  onEventClick,
  onDateClick,
  onDatesSet,
}: Props) {
  const smileosEvents = appointments.map((appt) => {
    const bg = (appt.gcal_color_id && GCAL_COLOR_HEX[appt.gcal_color_id])
      ?? STATUS_BG[appt.status as AppointmentStatus]
      ?? "#94a3b8";
    return {
      id: appt.id,
      title: appt.patient_name,
      start: appt.scheduled_at,
      end: appt.end_at,
      backgroundColor: bg,
      borderColor: bg,
      textColor: textColor(bg),
      extendedProps: appt,
    };
  });

  const gcalEvents = calendarEvents.map((ev) => {
    const color = ev.gcal_color ?? "#94a3b8";
    return {
      id: `gcal-${ev.id}`,
      title: ev.title,
      start: ev.start_at,
      end: ev.end_at,
      backgroundColor: color,
      borderColor: color,
      textColor: textColor(color),
      extendedProps: { _source: "gcal", ...ev },
    };
  });

  const events = [...smileosEvents, ...gcalEvents];

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-semibold [&_.fc-button]:text-sm [&_.fc-button]:capitalize [&_.fc-button-primary]:bg-blue-600 [&_.fc-button-primary]:border-blue-600 [&_.fc-button-primary:not(.fc-button-active)]:bg-white [&_.fc-button-primary:not(.fc-button-active)]:text-slate-700 [&_.fc-button-primary:not(.fc-button-active)]:border-slate-300 [&_.fc-today-button]:bg-white [&_.fc-today-button]:text-slate-700 [&_.fc-today-button]:border-slate-300 [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-md">
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
          if (arg.event.extendedProps._source === "gcal") {
            const start = new Date(arg.event.startStr);
            const y = start.getFullYear();
            const m = start.getMonth() + 1;
            const d = start.getDate();
            window.open(
              `https://calendar.google.com/calendar/u/1/r/day/${y}/${m}/${d}`,
              "_blank"
            );
            return;
          }
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
