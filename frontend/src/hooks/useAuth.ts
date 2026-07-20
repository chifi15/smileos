"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { AuthUser } from "@/types";

export function useLogin() {
  const { setUser } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await apiClient.post<{
        data: { access_token: string; user: AuthUser };
      }>("/api/v1/auth/login", payload);
      return data.data;
    },
    onSuccess: ({ access_token, user }) => {
      setUser(user, access_token);
      if (user.must_change_password) {
        router.replace("/change-password");
      } else {
        router.replace("/dashboard");
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        "Email o contraseña incorrectos.";
      toast.error(msg);
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout"),
    onSettled: () => {
      logout();
      router.replace("/login");
    },
  });
}

export function useChangePassword() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: {
      current_password: string;
      new_password: string;
      confirm_password: string;
    }) => apiClient.post("/api/v1/auth/change-password", payload),
    onSuccess: () => {
      toast.success("Contraseña actualizada. Inicia sesión nuevamente.");
      logout();
      router.replace("/login");
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        "La contraseña actual es incorrecta.";
      toast.error(msg);
    },
  });
}
