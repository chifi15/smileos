"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRegister } from "@/hooks/useAuth";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const register = useRegister();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    register.mutate({
      clinic_name: clinicName,
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
    });
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
        <h2 className="mb-6 text-lg font-semibold text-slate-800 dark:text-white">Crear cuenta</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de la clínica"
            type="text"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="Clínica Dental Sonrisa"
            autoComplete="organization"
            required
          />

          <Input
            label="Tu nombre completo"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dr. Juan Pérez"
            autoComplete="name"
            required
          />

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

          <Button
            type="submit"
            size="lg"
            loading={register.isPending}
            className="w-full mt-2"
          >
            Crear cuenta gratis
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-gray-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
