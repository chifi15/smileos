import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { AppointmentFull } from "@/types";

export function useAppointments(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["appointments", "list", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AppointmentFull[] }>(
        "/api/v1/appointments",
        { params: { date_from: dateFrom, date_to: dateTo } }
      );
      return data.data;
    },
    enabled: !!dateFrom && !!dateTo,
    refetchInterval: 60_000,
  });
}

export function usePatientAppointments(patientId: string) {
  return useQuery({
    queryKey: ["appointments", "patient", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AppointmentFull[] }>(
        "/api/v1/appointments",
        {
          params: {
            patient_id: patientId,
            date_from: "2020-01-01",
            date_to: "2035-12-31",
          },
        }
      );
      return data.data;
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateAppointment(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      patient_id: string;
      dentist_id: string;
      scheduled_at: string;
      duration_minutes: number;
      appointment_type: string;
      reason: string | null;
      notes: string | null;
    }) => {
      const { data } = await apiClient.post<{ data: AppointmentFull }>(
        "/api/v1/appointments",
        body
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cita creada.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al crear la cita.");
    },
  });
}

function makeStatusMutation(action: string, successMsg: string) {
  return function (onSuccess?: () => void) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        apiClient.post<{ data: AppointmentFull }>(`/api/v1/appointments/${id}/${action}`),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["appointments"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        toast.success(successMsg);
        onSuccess?.();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Error al actualizar la cita.");
      },
    });
  };
}

export const useConfirmAppointment = makeStatusMutation("confirm", "Cita confirmada.");
export const useStartAppointment = makeStatusMutation("start", "Cita iniciada.");
export const useCompleteAppointment = makeStatusMutation(
  "complete",
  "Cita completada. Puntos Smile Rewards otorgados."
);
export const useNoShowAppointment = makeStatusMutation("no-show", "Marcada como No Asistió.");

export function useEditAppointment(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        scheduled_at?: string;
        duration_minutes?: number;
        appointment_type?: string;
        dentist_id?: string;
        reason?: string | null;
        notes?: string | null;
      };
    }) => {
      const { data } = await apiClient.patch<{ data: AppointmentFull }>(
        `/api/v1/appointments/${id}`,
        body
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cita actualizada.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al actualizar la cita.");
    },
  });
}

export function useCancelAppointment(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post(`/api/v1/appointments/${id}/cancel`, {
        cancellation_reason: reason ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cita cancelada.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al cancelar la cita.");
    },
  });
}
