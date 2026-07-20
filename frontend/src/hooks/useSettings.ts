import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { ClinicSettings } from "@/types";

export function useClinicSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ClinicSettings }>("/api/v1/settings");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Omit<ClinicSettings, "id" | "created_at" | "updated_at">>) => {
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
