"use client";

import { FormEvent, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useLogin } from "@/hooks/useAuth";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { isAuthenticated, isInitializing } = useAuthStore();
  const router = useRouter();
  const login = useLogin();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isInitializing, router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f] dark:text-white">
          Smile<span className="text-blue-500">OS</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-gray-400">Sistema de gestión dental</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 px-8 py-8 shadow-lg">
        <h2 className="mb-6 text-lg font-semibold text-slate-800 dark:text-white">Iniciar sesión</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="doctor@clinica.com"
            autoComplete="email"
            required
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-blue-500 hover:text-blue-600">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={login.isPending}
            className="w-full mt-2"
          >
            Entrar
          </Button>
        </form>
      </div>

      <div className="mt-4">
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-gray-700" />
          </div>
          <span className="relative bg-transparent px-3 text-xs text-slate-400 dark:text-gray-500">o continúa con</span>
        </div>
        <button
          onClick={async () => {
            const { data } = await import("@/lib/api-client").then(m => m.default.get<{ data: { url: string } }>("/api/v1/auth/google/authorize"));
            window.location.href = data.data.url;
          }}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-blue-500 hover:text-blue-600 font-medium">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
