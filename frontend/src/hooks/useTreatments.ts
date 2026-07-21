import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { TreatmentPlan } from "@/types";

const base = (patientId: string) => `/api/v1/patients/${patientId}/treatment-plans`;

function invalidate(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ["treatments", patientId] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function usePatientPlans(patientId: string) {
  return useQuery({
    queryKey: ["treatments", patientId, "list"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TreatmentPlan[] }>(base(patientId));
      return data.data;
    },
    enabled: !!patientId,
  });
}

export function usePlan(patientId: string, planId: string) {
  return useQuery({
    queryKey: ["treatments", patientId, planId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TreatmentPlan }>(
        `${base(patientId)}/${planId}`
      );
      return data.data;
    },
    enabled: !!patientId && !!planId,
  });
}

export function useCreatePlan(patientId: string, onSuccess?: (plan: TreatmentPlan) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; diagnosis?: string; notes?: string }) => {
      const { data } = await apiClient.post<{ data: TreatmentPlan }>(base(patientId), {
        title: body.title,
        diagnosis: body.diagnosis || null,
        notes: body.notes || null,
      });
      return data.data;
    },
    onSuccess: (plan) => {
      invalidate(qc, patientId);
      toast.success("Plan de tratamiento creado.");
      onSuccess?.(plan);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al crear el plan.");
    },
  });
}

export function useUpdatePlan(patientId: string, planId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title?: string;
      diagnosis?: string | null;
      notes?: string | null;
      status?: "active" | "on_hold" | "abandoned";
      abandoned_reason?: string | null;
    }) => {
      const { data } = await apiClient.patch<{ data: TreatmentPlan }>(
        `${base(patientId)}/${planId}`,
        body
      );
      return data.data;
    },
    onSuccess: () => {
      invalidate(qc, patientId);
      qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
      toast.success("Plan actualizado.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al actualizar el plan.");
    },
  });
}

export function useAddItem(patientId: string, planId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      procedure_id: string;
      tooth_fdi?: string | null;
      priority?: "normal" | "urgent";
      notes?: string | null;
      quoted_price?: number | null;
    }) => {
      const { data } = await apiClient.post<{ data: TreatmentPlan }>(
        `${base(patientId)}/${planId}/items`,
        body
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
      toast.success("Procedimiento agregado.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al agregar procedimiento.");
    },
  });
}

export function useAddMultipleItems(patientId: string, planId: string, onSuccess?: (count: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      procedure_id: string;
      tooth_fdi?: string | null;
      priority?: "normal" | "urgent";
      notes?: string | null;
      quoted_price?: number | null;
    }>) => {
      for (const item of items) {
        await apiClient.post(`${base(patientId)}/${planId}/items`, item);
      }
      return items.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
      toast.success(`${count} procedimiento${count !== 1 ? "s" : ""} agregado${count !== 1 ? "s" : ""} al plan.`);
      onSuccess?.(count);
    },
    onError: (err: any) => {
      qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
      toast.error(err?.response?.data?.detail || "Error al agregar procedimientos.");
    },
  });
}

export function useDeleteItem(patientId: string, planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`${base(patientId)}/${planId}/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
      toast.success("Ítem eliminado.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al eliminar.");
    },
  });
}

function makeItemAction(action: string, label: string) {
  return (patientId: string, planId: string, onSuccess?: () => void) => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (payload: { itemId: string; body?: Record<string, unknown> }) =>
        apiClient.post(
          `${base(patientId)}/${planId}/items/${payload.itemId}/${action}`,
          payload.body ?? {}
        ),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["treatments", patientId, planId] });
        toast.success(label);
        onSuccess?.();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Error.");
      },
    });
  };
}

export const useStartItem = makeItemAction("start", "Procedimiento iniciado.");
export const useCancelItem = makeItemAction("cancel", "Procedimiento cancelado.");
export const useCompleteItem = makeItemAction("complete", "Procedimiento completado.");
export const useReopenItem = makeItemAction("reopen", "Procedimiento reabierto.");

export function useDeletePlan(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      apiClient.delete(`${base(patientId)}/${planId}`),
    onSuccess: () => {
      invalidate(qc, patientId);
      toast.success("Plan de tratamiento eliminado.");
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al eliminar el plan.");
    },
  });
}
