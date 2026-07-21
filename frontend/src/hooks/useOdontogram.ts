import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { OdontogramTooth, OdontogramSnapshot, QuoteItem } from "@/types";

export function useOdontogram(patientId: string, kind: string = "inicial") {
  return useQuery({
    queryKey: ["odontogram", patientId, kind],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: OdontogramTooth[] }>(
        `/api/v1/patients/${patientId}/odontogram?kind=${kind}`
      );
      return data.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateOdontogram(
  patientId: string,
  kind: string = "inicial",
  onSuccess?: () => void,
  onError?: () => void,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      teeth: Record<number, { condition?: string; notes?: string | null }>;
      snapshot_notes?: string | null;
    }) => {
      const { data } = await apiClient.patch(
        `/api/v1/patients/${patientId}/odontogram`,
        { ...body, kind }
      );
      return data.data as OdontogramTooth[];
    },
    onSuccess: (updatedTeeth) => {
      // Actualizar caché directamente con la respuesta del backend (sin re-fetch)
      qc.setQueryData(["odontogram", patientId, kind], updatedTeeth);
      toast.success("Guardado.", { id: "odontogram-save" });
      onSuccess?.();
    },
    onError: (err: any) => {
      qc.invalidateQueries({ queryKey: ["odontogram", patientId, kind] });
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        "Error al guardar el odontograma.";
      toast.error(msg, { id: "odontogram-save" });
      onError?.();
    },
  });
}

export function useOdontogramSnapshots(patientId: string, kind: string = "inicial") {
  return useQuery({
    queryKey: ["odontogram", patientId, "snapshots", kind],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: OdontogramSnapshot[] }>(
        `/api/v1/patients/${patientId}/odontogram/snapshots?kind=${kind}`
      );
      return data.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOdontogramSnapshot(patientId: string, snapshotId: string | null) {
  return useQuery({
    queryKey: ["odontogram", patientId, "snapshot", snapshotId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: OdontogramSnapshot }>(
        `/api/v1/patients/${patientId}/odontogram/snapshots/${snapshotId}`
      );
      return data.data;
    },
    enabled: !!patientId && !!snapshotId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCopyInicialToTratamiento(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(
        `/api/v1/patients/${patientId}/odontogram/copy-to-tratamiento`
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["odontogram", patientId, "tratamiento"] });
      toast.success("Plan de tratamiento actualizado desde el odontograma inicial.");
    },
    onError: () => toast.error("Error al copiar el odontograma."),
  });
}

export function useTreatmentQuote(patientId: string) {
  return useQuery({
    queryKey: ["quote", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: QuoteItem[] }>(
        `/api/v1/patients/${patientId}/treatment-quote`
      );
      return data.data ?? [];
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveTreatmentQuote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: QuoteItem[]) => {
      await apiClient.put(`/api/v1/patients/${patientId}/treatment-quote`, { items });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", patientId] });
    },
  });
}
