"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePlanStatus } from "@/hooks/useBilling";
import Spinner from "./Spinner";

interface PlanGateProps {
  feature: string;
  children: React.ReactNode;
}

export default function PlanGate({ feature, children }: PlanGateProps) {
  const { data: plan, isLoading } = usePlanStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const locked = !plan || plan.plan === "free" || plan.is_expired;

  if (!locked) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-gray-800">
        <Lock size={28} className="text-slate-400 dark:text-gray-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          {feature} requiere un plan de pago
        </h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 max-w-sm">
          Esta función está disponible en los planes <strong>Pro</strong> y{" "}
          <strong>Clinic</strong>. Actualiza tu plan para desbloquearla.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
