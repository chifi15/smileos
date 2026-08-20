import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { ClinicSettings } from "@/types";

export function useClinicSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { settings: ClinicSettings } }>("/api/v1/settings");
      return data.data.settings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Omit<ClinicSettings, "id" | "updated_at">>) => {
      const { data } = await apiClient.patch<{ data: ClinicSettings }>("/api/v1/settings", values);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["settings"], updated);
      toast.success("Configuración guardada.");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.error?.message;
      console.error("[settings] PATCH /api/v1/settings falló", { status, msg, payload: err });
      toast.error(msg ? `Error ${status}: ${msg}` : `Error al guardar (${status ?? "red"})`);
    },
  });
}
