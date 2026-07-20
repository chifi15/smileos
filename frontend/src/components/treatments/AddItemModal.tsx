"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useProcedures } from "@/hooks/useCatalog";
import { useAddItem } from "@/hooks/useTreatments";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
}

export default function AddItemModal({ open, onClose, patientId, planId }: Props) {
  const { data: procedures = [] } = useProcedures();
  const [procedureId, setProcedureId] = useState("");
  const [toothFdi, setToothFdi] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const add = useAddItem(patientId, planId, () => {
    onClose();
    setProcedureId(""); setToothFdi(""); setPriority("normal"); setPrice(""); setNotes("");
  });

  // Group by category
  const grouped = procedures.reduce<Record<string, typeof procedures>>((acc, p) => {
    const cat = p.category ?? "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const procedureOptions = [
    { value: "", label: "Seleccionar procedimiento..." },
    ...Object.entries(grouped).flatMap(([cat, procs]) => [
      { value: `__${cat}`, label: `── ${cat} ──`, disabled: true } as any,
      ...procs.map((p) => ({
        value: p.id,
        label: p.code ? `${p.code} — ${p.name}` : p.name,
      })),
    ]),
  ];

  // Pre-fill price from selected procedure
  function handleProcedureChange(id: string) {
    setProcedureId(id);
    const proc = procedures.find((p) => p.id === id);
    if (proc?.default_price != null) setPrice(String(proc.default_price));
    else setPrice("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!procedureId) return;
    add.mutate({
      procedure_id: procedureId,
      tooth_fdi: toothFdi || null,
      priority,
      notes: notes || null,
      quoted_price: price ? parseFloat(price) : null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar procedimiento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Procedimiento *"
          value={procedureId}
          onChange={(e) => handleProcedureChange(e.target.value)}
          options={procedureOptions}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Diente (FDI)"
            value={toothFdi}
            onChange={(e) => setToothFdi(e.target.value)}
            placeholder="Ej: 16, 36..."
          />
          <Select
            label="Prioridad"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
            options={[
              { value: "normal", label: "Normal" },
              { value: "urgent", label: "Urgente" },
            ]}
          />
        </div>

        <Input
          label="Precio cotizado (C$)"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />

        <Input
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones del procedimiento..."
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={add.isPending} disabled={!procedureId}>
            Agregar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
