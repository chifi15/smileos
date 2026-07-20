"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import apiClient, { setAccessToken } from "@/lib/api-client";
import { AuthUser } from "@/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, setInitialized } = useAuthStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (isAuthenticated) {
      setInitialized();
      return;
    }

    async function initSession() {
      try {
        const { data: refreshData } = await apiClient.post<{
          data: { access_token: string };
        }>("/api/v1/auth/refresh");

        setAccessToken(refreshData.data.access_token);

        const { data: meData } = await apiClient.get<{
          data: AuthUser;
        }>("/api/v1/auth/me");

        setUser(meData.data, refreshData.data.access_token);
      } catch {
        setInitialized();
      }
    }

    initSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
