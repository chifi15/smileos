"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { scheduleProactiveRefresh } from "@/providers/AuthProvider";
import { clearAccessToken } from "@/lib/api-client";
import apiClient from "@/lib/api-client";
import { AuthUser } from "@/types";

function GoogleCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const access_token = searchParams.get("access_token");
    const error = searchParams.get("error");

    if (error || !access_token) {
      router.replace("/login?error=google");
      return;
    }

    apiClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    apiClient.get<{ data: AuthUser }>("/api/v1/auth/me")
      .then(({ data }) => {
        setUser(data.data, access_token);
        scheduleProactiveRefresh(access_token, () => {
          clearAccessToken();
          router.replace("/login");
        });
        router.replace("/dashboard");
      })
      .catch(() => router.replace("/login?error=google"));
  }, []);

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f] dark:text-white mb-4">
        Smile<span className="text-blue-500">OS</span>
      </h1>
      <p className="text-slate-500 dark:text-gray-400 text-sm">Iniciando sesión con Google...</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallbackInner />
    </Suspense>
  );
}
