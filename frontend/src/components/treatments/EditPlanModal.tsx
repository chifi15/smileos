"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { useUpdatePlan } from "@/hooks/useTreatments";
import { TreatmentPlan } from "@/types";

interface Props {
  plan: TreatmentPlan;
  patientId: string;
  onClose: () => void;
}

// Edita nombre, diagnósticos y notas de un plan de tratamiento.
export default function EditPlanModal({ plan, patientId, onClose }: Props) {
  const [title, setTitle] = useState(plan.title);
  const [diagnosis, setDiagnosis] = useState(plan.diagnosis ?? "");
  const [notes, setNotes] = useState(plan.notes ?? "");
  const update = useUpdatePlan(patientId, plan.id, onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    // Se envía "" (y no null) para poder vaciar un campo: el backend ignora los null.
    update.mutate({ title: t, diagnosis: diagnosis.trim(), notes: notes.trim() });
  }

  return (
    <Modal open onClose={onClose} title="Editar plan de tratamiento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre del plan *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          required
          autoFocus
        />
        <Textarea
          label="Diagnósticos"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={4}
          placeholder="Uno por línea si son varios..."
        />
        <Textarea
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Consideraciones generales del plan..."
        />
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={update.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
