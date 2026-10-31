"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api-client";
import Sidebar from "@/components/layout/Sidebar";
import Spinner from "@/components/ui/Spinner";
import { Menu } from "lucide-react";

const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;

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
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Cierra el drawer al navegar
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (user?.must_change_password) {
      router.replace("/change-password");
    }
  }, [isInitializing, isAuthenticated, user, pathname]); // router intencionalmente excluido

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
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 bg-[#1e3a5f] px-4 border-b border-white/10">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <span className="text-lg font-bold tracking-tight text-white">
          Smile<span className="text-blue-400">OS</span>
        </span>
      </div>

      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
