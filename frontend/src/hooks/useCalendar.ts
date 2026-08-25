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
  oauth_connected: boolean;
  oauth_available: boolean;
  calendar_id: string | null;
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

export function useDisconnectGoogleOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete("/api/v1/calendar/oauth/disconnect"),
    onSuccess: () => {
      toast.success("Google Calendar desconectado.");
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: () => toast.error("Error al desconectar."),
  });
}

// Nombres en español para cada colorId de eventos de Google Calendar
export const GCAL_COLOR_NAMES: Record<string, string> = {
  "1": "Lavanda", "2": "Salvia", "3": "Uva", "4": "Flamingo",
  "5": "Girasol", "6": "Mandarina", "7": "Pavo real", "8": "Grafito",
  "9": "Arándano", "10": "Albahaca", "11": "Tomate",
};

export function useGcalEventColors() {
  return useQuery({
    queryKey: ["calendar", "event-colors"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<string, string> }>("/api/v1/calendar/event-colors");
      return data.data; // { "1": "#hex", ... }
    },
    staleTime: 24 * 60 * 60 * 1000,
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
        const colorMsg = d.colors_found > 0 ? `, ${d.colors_found} con color` : ", sin colores (Google no los exporta)";
        toast.success(
          `Sincronizado: ${d.total_events} eventos, ${d.matched_patients} vinculados a un paciente${colorMsg}.`
        );
        qc.invalidateQueries({ queryKey: ["calendar"] });
        qc.invalidateQueries({ queryKey: ["patients", "segments"] });
      }
    },
    onError: () => toast.error("Error al sincronizar el calendario."),
  });
}
