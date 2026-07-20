"use client";

import { FormEvent, useState } from "react";
import { useChangePassword } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ShieldCheck } from "lucide-react";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Mínimo 8 caracteres.";
  if (!/[A-Z]/.test(password)) return "Debe tener al menos una mayúscula.";
  if (!/[a-z]/.test(password)) return "Debe tener al menos una minúscula.";
  if (!/\d/.test(password)) return "Debe tener al menos un número.";
  return null;
}

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuthStore();
  const changePassword = useChangePassword();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const passwordError = validatePassword(next);
    if (passwordError) newErrors.next = passwordError;
    if (next !== confirm) newErrors.confirm = "Las contraseñas no coinciden.";
    if (!current) newErrors.current = "Ingresa tu contraseña actual.";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    changePassword.mutate({
      current_password: current,
      new_password: next,
      confirm_password: confirm,
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">
          Smile<span className="text-blue-500">OS</span>
        </h1>
      </div>

      <div className="rounded-2xl bg-white px-8 py-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
            <ShieldCheck size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {user?.must_change_password ? "Cambia tu contraseña" : "Nueva contraseña"}
            </h2>
            {user?.must_change_password && (
              <p className="text-xs text-slate-500">
                Debes configurar una contraseña segura para continuar.
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Contraseña actual"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
            error={errors.current}
            autoComplete="current-password"
          />

          <Input
            label="Nueva contraseña"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
            error={errors.next}
            autoComplete="new-password"
          />

          <Input
            label="Confirmar contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            error={errors.confirm}
            autoComplete="new-password"
          />

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Requisitos:</p>
            <p>• Mínimo 8 caracteres</p>
            <p>• Al menos una mayúscula y una minúscula</p>
            <p>• Al menos un número</p>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={changePassword.isPending}
            className="w-full"
          >
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
