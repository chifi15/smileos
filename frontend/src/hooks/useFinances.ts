import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import {
  FinanceTransaction,
  FinanceSummary,
  TransactionCreatePayload,
} from "@/types";

const keys = {
  transactions: (year: number, month: number, type?: string) =>
    ["finances", year, month, type ?? "all"] as const,
  summary: (year: number, month: number) =>
    ["finances-summary", year, month] as const,
  rate: () => ["exchange-rate"] as const,
};

export function useExchangeRate() {
  return useQuery({
    queryKey: keys.rate(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { rate: number } }>(
        "/api/v1/finances/exchange-rate"
      );
      return data.data.rate;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rate: number) => {
      const { data } = await apiClient.patch<{ data: { rate: number } }>(
        "/api/v1/finances/exchange-rate",
        { rate }
      );
      return data.data.rate;
    },
    onSuccess: (rate) => {
      qc.setQueryData(keys.rate(), rate);
      toast.success("Tasa de cambio actualizada.");
    },
    onError: () => toast.error("Error al actualizar la tasa de cambio."),
  });
}

export function useFinanceSummary(year: number, month: number) {
  return useQuery({
    queryKey: keys.summary(year, month),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FinanceSummary }>(
        `/api/v1/finances/summary?year=${year}&month=${month}`
      );
      return data.data;
    },
  });
}

export function useTransactions(
  year: number,
  month: number,
  type?: string
) {
  return useQuery({
    queryKey: keys.transactions(year, month, type),
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (type) params.set("type", type);
      const { data } = await apiClient.get<{ data: FinanceTransaction[] }>(
        `/api/v1/finances?${params}`
      );
      return data.data;
    },
  });
}

export function useCreateTransaction(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransactionCreatePayload) => {
      const { data } = await apiClient.post<{ data: FinanceTransaction }>(
        "/api/v1/finances",
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      qc.invalidateQueries({ queryKey: keys.summary(year, month) });
      toast.success("Transacción registrada.");
    },
    onError: () => toast.error("Error al registrar la transacción."),
  });
}

export function usePatientTransactions(patientId: string | null) {
  return useQuery({
    queryKey: ["finances-patient-txs", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FinanceTransaction[] }>(
        `/api/v1/finances/patient/${patientId}`
      );
      return data.data;
    },
    enabled: !!patientId,
  });
}

export function useIncomeByPatient(year?: number, month?: number) {
  return useQuery({
    queryKey: ["finances-by-patient", year, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year) params.set("year", String(year));
      if (month) params.set("month", String(month));
      const { data } = await apiClient.get<{
        data: { patient_id: string; patient_name: string; total: number; count: number }[];
      }>(`/api/v1/finances/by-patient?${params}`);
      return data.data;
    },
  });
}

export function useUpdateTransaction(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ txId, payload }: { txId: string; payload: Partial<TransactionCreatePayload> }) => {
      const { data } = await apiClient.patch<{ data: FinanceTransaction }>(
        `/api/v1/finances/${txId}`,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      qc.invalidateQueries({ queryKey: ["finances-summary", year, month] });
      qc.invalidateQueries({ queryKey: ["finances-by-patient"] });
      toast.success("Transacción actualizada.");
    },
    onError: () => toast.error("Error al actualizar la transacción."),
  });
}

export function useDeleteTransaction(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txId: string) => {
      await apiClient.delete(`/api/v1/finances/${txId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      qc.invalidateQueries({ queryKey: keys.summary(year, month) });
      toast.success("Transacción eliminada.");
    },
    onError: () => toast.error("Error al eliminar la transacción."),
  });
}

export function useBulkDeleteTransactions(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`/api/v1/finances/${id}`)));
    },
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      qc.invalidateQueries({ queryKey: keys.summary(year, month) });
      toast.success(`${ids.length} ${ids.length === 1 ? "transacción eliminada" : "transacciones eliminadas"}.`);
    },
    onError: () => toast.error("Error al eliminar las transacciones."),
  });
}

export function useUploadReceipt(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ txId, file }: { txId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.post(`/api/v1/finances/${txId}/receipt`, fd);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      toast.success("Comprobante guardado.");
    },
    onError: () => toast.error("Error al subir el comprobante."),
  });
}

export function useDeleteReceipt(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txId: string) => {
      await apiClient.delete(`/api/v1/finances/${txId}/receipt`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finances", year, month] });
      toast.success("Comprobante eliminado.");
    },
    onError: () => toast.error("Error al eliminar el comprobante."),
  });
}
