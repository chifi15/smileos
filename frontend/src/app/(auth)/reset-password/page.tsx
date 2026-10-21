"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/api/v1/auth/reset-password", {
        token,
        new_password: password,
        confirm_password: confirmPassword,
      });
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      router.replace("/login");
    } catch (err: any) {
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.detail ||
        "El enlace es inválido o ya expiró.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-slate-500 dark:text-gray-400">Enlace inválido.</p>
        <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium text-sm">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f] dark:text-white">
          Smile<span className="text-blue-500">OS</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-gray-400">Sistema de gestión dental</p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 px-8 py-8 shadow-lg">
        <h2 className="mb-6 text-lg font-semibold text-slate-800 dark:text-white">Nueva contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            required
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Guardar contraseña
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
        <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
