"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api-client";
import Sidebar from "@/components/layout/Sidebar";
import Spinner from "@/components/ui/Spinner";

const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000; // 7 horas (token dura 8)

async function silentRefresh() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/refresh`,
      { method: "POST", credentials: "include" }
    );
    if (res.ok) {
      const data = await res.json();
      const token = data?.data?.access_token;
      if (token) setAccessToken(token);
    }
  } catch {
    // silencioso — el interceptor de axios manejará el siguiente 401
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.must_change_password) {
      router.replace("/change-password");
    }
  }, [isInitializing, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Cargando SmileOS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
