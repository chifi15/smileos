"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import PatientSearch from "@/components/ui/PatientSearch";

export default function PhotosPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  function handleSelect(p: { id: string; name: string } | null) {
    setSelected(p);
    if (p) router.push(`/patients/${p.id}/photos`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Camera size={32} className="text-slate-600" />
          </div>
        </div>
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Fotografías</h1>
        <p className="mb-6 text-sm text-slate-500">
          Busca un paciente para ver o subir fotografías clínicas.
        </p>
        <PatientSearch
          value={selected}
          onChange={handleSelect}
          placeholder="Buscar paciente..."
        />
      </div>
    </div>
  );
}
