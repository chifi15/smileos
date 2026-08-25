import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export interface CalendarEvent {
  id: string;
  ical_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  patient_id: string | null;
  match_confidence: number | null;
  gcal_color: string | null;
}

export interface CalendarStatus {
  configured: boolean;
  last_synced_at: string | null;
}

export function useCalendarStatus() {
  return useQuery({
    queryKey: ["calendar", "status"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CalendarStatus }>("/api/v1/calendar/status");
      return data.data;
    },
  });
}

export function useCalendarEvents(dateFrom: string, dateTo: string, enabled = true) {
  return useQuery({
    queryKey: ["calendar", "events", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CalendarEvent[] }>("/api/v1/calendar/events", {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      return data.data;
    },
    enabled: enabled && !!dateFrom && !!dateTo,
    staleTime: 1000 * 60 * 15, // 15 min
  });
}

export function useSyncCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/api/v1/calendar/sync"),
    onSuccess: (res) => {
      const d = (res.data as any).data;
      if (d.error) {
        toast.error(d.error);
      } else {
        toast.success(
          `Sincronizado: ${d.total_events} eventos, ${d.matched_patients} vinculados a un paciente.`
        );
        qc.invalidateQueries({ queryKey: ["calendar"] });
        qc.invalidateQueries({ queryKey: ["patients", "segments"] });
      }
    },
    onError: () => toast.error("Error al sincronizar el calendario."),
  });
}
