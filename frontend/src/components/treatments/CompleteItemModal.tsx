"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useCompleteItem } from "@/hooks/useTreatments";
import { CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
  itemId: string;
  procedureName: string | null;
}

export default function CompleteItemModal({
  open, onClose, patientId, planId, itemId, procedureName,
}: Props) {
  const complete = useCompleteItem(patientId, planId, onClose);

  function handleConfirm() {
    complete.mutate({ itemId, body: {} });
  }

  return (
    <Modal open={open} onClose={onClose} title="Completar procedimiento" size="sm">
      <div className="space-y-5">
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ¿Marcar como completado?{" "}
          <strong>{procedureName}</strong>
        </div>
        <p className="text-xs text-slate-500">
          Se registrará la fecha y hora actual como fecha de finalización y se acumularán los puntos de recompensa correspondientes.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            loading={complete.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 size={15} />
            Completar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
