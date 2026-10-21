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

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-blue-500 hover:text-blue-600 font-medium">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
