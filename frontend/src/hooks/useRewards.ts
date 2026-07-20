import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { RewardsAccount, RewardsTransaction, PaginatedMeta, RewardsConfig } from "@/types";

export function useRewardsAccount(patientId: string) {
  return useQuery({
    queryKey: ["rewards", patientId, "account"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RewardsAccount }>(
        `/api/v1/patients/${patientId}/rewards`
      );
      return data.data;
    },
    enabled: !!patientId,
  });
}

export function useRewardsTransactions(patientId: string, page = 1) {
  return useQuery({
    queryKey: ["rewards", patientId, "transactions", page],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: RewardsTransaction[];
        meta: PaginatedMeta;
      }>(`/api/v1/patients/${patientId}/rewards/transactions`, {
        params: { page, per_page: 20 },
      });
      return data;
    },
    enabled: !!patientId,
  });
}

export function useAdjustRewards(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      transaction_type: "manual_add" | "manual_deduct";
      points: number;
      description: string;
    }) => {
      const signedPoints =
        body.transaction_type === "manual_deduct" ? -body.points : body.points;
      const { data } = await apiClient.post(
        `/api/v1/patients/${patientId}/rewards/adjust`,
        { points: signedPoints, description: body.description }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards", patientId] });
      toast.success("Ajuste de puntos aplicado.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al aplicar el ajuste.");
    },
  });
}

export function useExpireRewards(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(
        `/api/v1/patients/${patientId}/rewards/expire`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards", patientId] });
      toast.success("Puntos expirados. El paciente regresa al nivel Starter.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al expirar los puntos.");
    },
  });
}

export function useRewardsConfig() {
  return useQuery({
    queryKey: ["rewards", "config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RewardsConfig }>("/api/v1/rewards/config");
      return data.data;
    },
  });
}

export interface RewardsConfigPayload {
  points_overrides: Record<string, number>;
  level_overrides: Record<string, number>;
  custom_types: Record<string, { label: string; points: number }>;
  level_benefits: Record<string, { discount_pct: number; perks: string[] }>;
}

export function useUpdateRewardsConfig(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RewardsConfigPayload) => {
      const { data } = await apiClient.put("/api/v1/rewards/config", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards", "config"] });
      toast.success("Configuración guardada correctamente.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al guardar la configuración.");
    },
  });
}
