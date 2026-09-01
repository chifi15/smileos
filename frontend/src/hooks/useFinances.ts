import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import {
  FinanceTransaction,
  FinanceSummary,
  TransactionCreatePayload,
} from "@/types";

export interface HonorariosProcedure {
  procedure_id: string;
  procedure_name: string;
  fee_per_unit: number;
  quantity: number;
  total_honorarios: number;
}

export interface HonorariosDoctor {
  doctor_id: string | null;
  doctor_name: string;
  total_honorarios: number;
  procedures: Omit<HonorariosProcedure, "procedure_id">[];
}

export interface HonorariosData {
  total_honorarios: number;
  by_procedure: HonorariosProcedure[];
  by_doctor: HonorariosDoctor[];
}

const keys = {
  transactions: (year: number, month: number, type?: string) =>
    ["finances", year, month, type ?? "all"] as const,
  summary: (year: number, month: number) =>
    ["finances-summary", year, month] as const,
  honorarios: (year: number, month: number) =>
    ["finances-honorarios", year, month] as const,
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
      qc.invalidateQueries({ queryKey: ["costos", "products"] });
      toast.success("Transacción registrada.");
    },
    onError: () => toast.error("Error al registrar la transacción."),
  });
}

export function useTransaction(txId: string | null) {
  return useQuery({
    queryKey: ["finance-tx", txId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FinanceTransaction }>(`/api/v1/finances/${txId}`);
      return data.data;
    },
    enabled: !!txId,
    retry: false,
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

export interface DoctorOption {
  id: string;
  full_name: string;
  role: string;
}

export function useDoctors() {
  return useQuery({
    queryKey: ["finances-doctors"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DoctorOption[] }>("/api/v1/finances/doctors");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHonorarios(year: number, month: number) {
  return useQuery({
    queryKey: keys.honorarios(year, month),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: HonorariosData }>(
        `/api/v1/finances/honorarios?year=${year}&month=${month}`
      );
      return data.data;
    },
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
      qc.invalidateQueries({ queryKey: ["costos", "products"] });
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
      qc.invalidateQueries({ queryKey: ["costos", "products"] });
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
      qc.invalidateQueries({ queryKey: ["costos", "products"] });
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

export interface ExpenseCategoryItem {
  id: string;
  key: string;
  label: string;
  sort_order: number;
}

const EXPENSE_CATS_KEY = ["finances", "expense-categories"] as const;

export function useExpenseCategories() {
  return useQuery<ExpenseCategoryItem[]>({
    queryKey: EXPENSE_CATS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: ExpenseCategoryItem[]; id?: string }[]>(
        "/api/v1/finances/expense-categories"
      );
      return data as unknown as ExpenseCategoryItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const { data } = await apiClient.post<ExpenseCategoryItem>("/api/v1/finances/expense-categories", { label });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSE_CATS_KEY }),
    onError: () => toast.error("Error al crear la categoría."),
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { data } = await apiClient.patch<ExpenseCategoryItem>(`/api/v1/finances/expense-categories/${id}`, { label });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSE_CATS_KEY }),
    onError: () => toast.error("Error al actualizar la categoría."),
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/finances/expense-categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSE_CATS_KEY }),
    onError: () => toast.error("Error al eliminar la categoría."),
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
