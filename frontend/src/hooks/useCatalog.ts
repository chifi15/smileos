import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { Procedure } from "@/types";

export function useProcedures() {
  return useQuery({
    queryKey: ["catalog", "procedures"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Procedure[] }>("/api/v1/catalog/procedures");
      return data.data.filter((p) => p.is_active);
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateProcedurePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, price, operational_cost, name }: { id: string; price?: number | null; operational_cost?: number | null; name?: string }) => {
      const body: Record<string, number | null | string> = {};
      if (price !== undefined) body.default_price = price;
      if (operational_cost !== undefined) body.operational_cost = operational_cost;
      if (name !== undefined) body.name = name;
      const { data } = await apiClient.patch(`/api/v1/catalog/procedures/${id}`, body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "procedures"] });
      toast.success("Actualizado.");
    },
    onError: () => toast.error("Error al actualizar."),
  });
}

export function useDeleteProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/catalog/procedures/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "procedures"] });
      toast.success("Procedimiento eliminado.");
    },
    onError: () => toast.error("Error al eliminar el procedimiento."),
  });
}

export function useCreateProcedure(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; default_price: number | null; default_duration_minutes: number }) => {
      const { data } = await apiClient.post("/api/v1/catalog/procedures", body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "procedures"] });
      toast.success("Procedimiento creado.");
      onSuccess?.();
    },
    onError: () => toast.error("Error al crear el procedimiento."),
  });
}
