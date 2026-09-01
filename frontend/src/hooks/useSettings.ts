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
    onError: () => toast.error("Error al guardar la configuración."),
  });
}

export function useUiPreferences() {
  return useQuery({
    queryKey: ["ui-preferences"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<string, string> }>("/api/v1/settings/ui-preferences");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateUiPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const { data } = await apiClient.patch<{ data: Record<string, string> }>("/api/v1/settings/ui-preferences", patch);
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["ui-preferences"], updated);
    },
  });
}
