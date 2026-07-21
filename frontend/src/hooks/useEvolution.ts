import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { PatientEvolution, EvolutionAttendance } from "@/types";

const base = (patientId: string) => `/api/v1/patients/${patientId}/evolutions`;

export function useEvolutions(patientId: string) {
  return useQuery({
    queryKey: ["evolutions", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PatientEvolution[] }>(base(patientId));
      return data.data;
    },
    enabled: !!patientId,
  });
}

export function useCreateEvolution(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      date: string;
      note: string;
      attendance: EvolutionAttendance | null;
    }) => {
      const { data } = await apiClient.post<{ data: PatientEvolution }>(base(patientId), body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolutions", patientId] });
      toast.success("Nota guardada.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || "Error al guardar la nota.");
    },
  });
}

export function useUpdateEvolution(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evolutionId,
      body,
    }: {
      evolutionId: string;
      body: { date?: string; note?: string; attendance?: EvolutionAttendance | null };
    }) => {
      const { data } = await apiClient.patch<{ data: PatientEvolution }>(
        `${base(patientId)}/${evolutionId}`,
        body
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolutions", patientId] });
      toast.success("Nota actualizada.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || "Error al actualizar la nota.");
    },
  });
}

export function useDeleteEvolution(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (evolutionId: string) =>
      apiClient.delete(`${base(patientId)}/${evolutionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolutions", patientId] });
      toast.success("Nota eliminada.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || "Error al eliminar la nota.");
    },
  });
}
