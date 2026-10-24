import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { ClinicSettings } from "@/types";

export interface WorkingHour {
  id?: string;
  day_of_week: number;
  is_working_day: boolean;
  morning_open: string | null;
  morning_close: string | null;
  afternoon_open: string | null;
  afternoon_close: string | null;
}

export function useClinicSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { settings: ClinicSettings; working_hours: WorkingHour[] } }>("/api/v1/settings");
      return data.data.settings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkingHours() {
  return useQuery({
    queryKey: ["working-hours"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { working_hours: WorkingHour[]; clinic_slug: string } }>("/api/v1/settings");
      return { hours: data.data.working_hours, clinic_slug: data.data.clinic_slug };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hours: WorkingHour[]) => {
      const entries = hours.map((h) => ({
        day_of_week: h.day_of_week,
        is_working_day: h.is_working_day,
        morning_open: h.morning_open,
        morning_close: h.morning_close,
        afternoon_open: h.afternoon_open,
        afternoon_close: h.afternoon_close,
      }));
      const { data } = await apiClient.put<{ data: WorkingHour[] }>("/api/v1/settings/working-hours", { hours: entries });
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["working-hours"], (old: { hours: WorkingHour[]; clinic_slug: string } | undefined) => ({
        hours: updated,
        clinic_slug: old?.clinic_slug ?? "",
      }));
      toast.success("Horario guardado.");
    },
    onError: () => toast.error("Error al guardar el horario."),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Omit<ClinicSettings, "id" | "updated_at">>) => {
      const { data } = await apiClient.patch<{ data: ClinicSettings }>("/api/v1/settings", values);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["settings"], updated);
      toast.success("Configuración guardada.");
    },
    onError: () => toast.error("Error al guardar la configuración."),
  });
}

export function useUiPreferences() {
  return useQuery({
    queryKey: ["ui-preferences"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<string, string> }>("/api/v1/settings/ui-preferences");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBookingAppointmentTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (types: { value: string; label: string }[]) => {
      const { data } = await apiClient.put<{ data: { value: string; label: string }[] }>(
        "/api/v1/settings/booking-appointment-types", types
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Tipos de consulta guardados.");
    },
    onError: () => toast.error("Error al guardar los tipos de consulta."),
  });
}

export interface ClinicHoliday {
  id: string;
  date: string;
  description: string | null;
}

export function useClinicHolidays() {
  return useQuery({
    queryKey: ["clinic-holidays"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { settings: ClinicSettings; working_hours: unknown[]; upcoming_holidays: ClinicHoliday[]; clinic_slug: string } }>("/api/v1/settings");
      return data.data.upcoming_holidays ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { date: string; description?: string }) => {
      const { data } = await apiClient.post<{ data: ClinicHoliday }>("/api/v1/settings/holidays", body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["clinic-holidays"] });
      toast.success("Día no disponible guardado.");
    },
    onError: () => toast.error("Error al guardar el día."),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/settings/holidays/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["clinic-holidays"] });
      toast.success("Día eliminado.");
    },
    onError: () => toast.error("Error al eliminar el día."),
  });
}

// ─── Días libres por doctor ───────────────────────────────────────────────────

export interface UserDayOff {
  id: string;
  user_id: string;
  date: string;
  description: string | null;
}

export interface DoctorWithDaysOff {
  user: {
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
  };
  days_off: UserDayOff[];
}

export function useDoctorsDaysOff() {
  return useQuery({
    queryKey: ["doctors-days-off"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DoctorWithDaysOff[] }>("/api/v1/settings/doctors-days-off");
      return data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddUserDayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, date, description }: { userId: string; date: string; description?: string }) => {
      const { data } = await apiClient.post<{ data: UserDayOff }>(`/api/v1/users/${userId}/days-off`, { date, description });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors-days-off"] });
      toast.success("Día libre guardado.");
    },
    onError: () => toast.error("Error al guardar el día libre."),
  });
}

export function useDeleteUserDayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, dayOffId }: { userId: string; dayOffId: string }) => {
      await apiClient.delete(`/api/v1/users/${userId}/days-off/${dayOffId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors-days-off"] });
      toast.success("Día libre eliminado.");
    },
    onError: () => toast.error("Error al eliminar el día libre."),
  });
}

export function useUpdateUiPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const { data } = await apiClient.patch<{ data: Record<string, string> }>("/api/v1/settings/ui-preferences", patch);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["ui-preferences"], updated);
    },
  });
}
