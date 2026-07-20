"use client";

import { useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { usePatientAppointments } from "@/hooks/useAppointments";
import { useCompleteItem } from "@/hooks/useTreatments";
import { APPOINTMENT_TYPE_LABELS } from "@/types";

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
  const [appointmentId, setAppointmentId] = useState("");
  const cutoff = subDays(new Date(), 90);

  const { data: allAppts = [] } = usePatientAppointments(patientId);

  const patientAppts = allAppts
    .filter(
      (a) =>
        ["completed", "in_progress"].includes(a.status) &&
        parseISO(a.scheduled_at) >= cutoff
    )
    .sort((a, b) => (a.scheduled_at > b.scheduled_at ? -1 : 1));

  const complete = useCompleteItem(patientId, planId, () => {
    onClose();
    setAppointmentId("");
  });

  const apptOptions = [
    { value: "", label: "Seleccionar cita..." },
    ...patientAppts.map((a) => ({
      value: a.id,
      label: `${format(parseISO(a.scheduled_at), "dd/MM/yyyy HH:mm", { locale: es })} — ${APPOINTMENT_TYPE_LABELS[a.appointment_type]}`,
    })),
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointmentId) return;
    complete.mutate({ itemId, body: { appointment_id: appointmentId } });
  }

  return (
    <Modal open={open} onClose={onClose} title="Completar procedimiento" size="sm">
      <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        Completando: <strong>{procedureName}</strong>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Cita en la que se realizó *"
          value={appointmentId}
          onChange={(e) => setAppointmentId(e.target.value)}
          options={apptOptions}
        />
        {patientAppts.length === 0 && (
          <p className="text-xs text-slate-400">
            No se encontraron citas completadas o en progreso en los últimos 90 días para este paciente.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={complete.isPending}
            disabled={!appointmentId}
            className="bg-green-600 hover:bg-green-700"
          >
            Completar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
