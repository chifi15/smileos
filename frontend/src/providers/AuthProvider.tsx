"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import apiClient, { setAccessToken, clearAccessToken } from "@/lib/api-client";
import { AuthUser } from "@/types";

// ─── Proactive token refresh ────────────────────────────────────────────────
// Refreshes the access token 60 s before it expires so background React Query
// fetches never hit an expired token and trigger a full-page reload.

let _proactiveTimer: ReturnType<typeof setTimeout> | null = null;

function decodeExp(token: string): number {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)).exp * 1000; // ms
  } catch {
    return 0;
  }
}

export function scheduleProactiveRefresh(
  token: string,
  onExpired: () => void
) {
  if (_proactiveTimer) clearTimeout(_proactiveTimer);

  const delay = Math.max(0, decodeExp(token) - Date.now() - 60_000);
  if (delay === 0) return; // already near expiry — let the 401 interceptor handle it

  _proactiveTimer = setTimeout(async () => {
    try {
      const { data } = await apiClient.post<{ data: { access_token: string } }>(
        "/api/v1/auth/refresh"
      );
      const newToken = data.data.access_token;
      setAccessToken(newToken);
      scheduleProactiveRefresh(newToken, onExpired); // chain the next refresh
    } catch {
      clearAccessToken();
      onExpired();
    }
  }, delay);
}

export function clearProactiveRefresh() {
  if (_proactiveTimer) {
    clearTimeout(_proactiveTimer);
    _proactiveTimer = null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, setInitialized, logout } = useAuthStore();
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

        scheduleProactiveRefresh(refreshData.data.access_token, () => {
          logout();
          window.location.href = "/login";
        });
      } catch {
        setInitialized();
      }
    }

    initSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
