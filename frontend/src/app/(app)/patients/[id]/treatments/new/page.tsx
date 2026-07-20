"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useCreatePlan } from "@/hooks/useTreatments";
import { usePatient } from "@/hooks/usePatients";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { useState } from "react";

export default function NewTreatmentPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: patient } = usePatient(id);
  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const create = useCreatePlan(id, (plan) => {
    router.push(`/patients/${id}/treatments/${plan.id}`);
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ title, diagnosis, notes });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/patients/${id}/treatments`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={16} />
          {patient?.full_name ?? "Paciente"}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">Nuevo plan de tratamiento</h1>
      </div>

      <div className="max-w-xl rounded-xl bg-white p-8 shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Título del plan *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Rehabilitación oral completa"
            required
            autoFocus
          />
          <Textarea
            label="Diagnóstico"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={3}
            placeholder="Hallazgos clínicos y diagnóstico..."
          />
          <Textarea
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Consideraciones generales del plan..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => window.history.back()}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
              Crear plan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
