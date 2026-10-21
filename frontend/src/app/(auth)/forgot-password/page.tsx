"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/api/v1/auth/forgot-password", { email });
      setSent(true);
    } catch {
      toast.error("Ocurrió un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
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
        {sent ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">📬</div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Revisa tu correo</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. El enlace expira en 30 minutos.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-white">¿Olvidaste tu contraseña?</h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-gray-400">
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinica.com"
                autoComplete="email"
                required
              />
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Enviar enlace
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
        <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
