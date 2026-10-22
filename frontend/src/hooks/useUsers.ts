import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { ClinicUser, UserRole } from "@/types";

export function useClinicUsers() {
  return useQuery({
    queryKey: ["users", "list"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ClinicUser[] }>("/api/v1/users");
      return data.data.filter((u) => u.is_active);
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["users", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ClinicUser[] }>("/api/v1/users");
      return data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; full_name?: string; email?: string; role?: UserRole; phone?: string; gcal_color_id?: string | null }) => {
      const { data } = await apiClient.patch<{ data: ClinicUser }>(`/api/v1/users/${id}`, values);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario actualizado.");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Error al actualizar el usuario.";
      toast.error(msg);
    },
  });
}

export function useCreateUser(
  onSuccess?: (result: { user: ClinicUser; temp_password: string }) => void
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      email: string;
      full_name: string;
      role: UserRole;
      phone?: string;
    }) => {
      const { data } = await apiClient.post<{
        data: { user: ClinicUser; temp_password: string };
      }>("/api/v1/users", values);
      return data.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.(result);
    },
    onError: () => toast.error("Error al crear el usuario."),
  });
}
