import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { RewardsAccount, RewardsTransaction, PaginatedMeta } from "@/types";

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
      // Backend expects signed points: positive = add, negative = deduct
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
