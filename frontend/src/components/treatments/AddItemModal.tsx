"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useTreatmentPrices } from "@/hooks/useTreatmentPrices";
import { useAddItem } from "@/hooks/useTreatments";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
}

export default function AddItemModal({ open, onClose, patientId, planId }: Props) {
  const { treatments, prices } = useTreatmentPrices();
  const [procedureId, setProcedureId] = useState("");
  const [toothFdi, setToothFdi] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const add = useAddItem(patientId, planId, () => {
    onClose();
    setProcedureId(""); setToothFdi(""); setPriority("normal"); setPrice(""); setNotes("");
  });

  // Procedimientos = tratamientos de Costos Operativos
  const procedureOptions = [
    { value: "", label: "Seleccionar procedimiento..." },
    ...treatments.map((t) => ({ value: t.id, label: t.name })),
  ];

  // Pre-fill price from the calculated price of the selected treatment
  function handleProcedureChange(id: string) {
    setProcedureId(id);
    const p = prices.get(id);
    setPrice(p != null ? String(p) : "");
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
            label="Diente (FDI, ej: 16 o 5.4 si es temporal)"
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
