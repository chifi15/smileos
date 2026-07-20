"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Settings } from "lucide-react";
import PatientSearch from "@/components/ui/PatientSearch";

export default function RewardsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  function handleSelect(p: { id: string; name: string } | null) {
    setSelected(p);
    if (p) router.push(`/patients/${p.id}/rewards`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-50">
            <Star size={32} className="text-yellow-500" />
          </div>
        </div>
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Smile Rewards</h1>
        <p className="mb-6 text-sm text-slate-500">
          Busca un paciente para ver su cuenta de puntos e historial.
        </p>
        <PatientSearch
          value={selected}
          onChange={handleSelect}
          placeholder="Buscar paciente..."
        />

        <div className="mt-6 border-t border-slate-100 pt-5">
          <Link
            href="/rewards/config"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors rounded-lg px-4 py-2 hover:bg-slate-50 border border-slate-200"
          >
            <Settings size={15} />
            Configurar programa de puntos
          </Link>
        </div>
      </div>
    </div>
  );
}
