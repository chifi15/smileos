"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import PatientSearch from "@/components/ui/PatientSearch";
import { useCreateAppointment } from "@/hooks/useAppointments";
import { useClinicUsers } from "@/hooks/useUsers";
import { useAuthStore } from "@/stores/auth.store";
import { APPOINTMENT_TYPE_LABELS, AppointmentType } from "@/types";

interface Props {
  dateStr: string | null; // e.g. "2026-07-19T10:00:00" or "2026-07-19"
  onClose: () => void;
  prefilledPatient?: { id: string; name: string };
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hora" },
  { value: "75", label: "1h 15min" },
  { value: "90", label: "1h 30min" },
  { value: "120", label: "2 horas" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Seleccionar tipo..." },
  ...(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentType[]).map((k) => ({
    value: k,
    label: APPOINTMENT_TYPE_LABELS[k],
  })),
];

export default function NewAppointmentModal({ dateStr, onClose, prefilledPatient }: Props) {
  const { user } = useAuthStore();
  const { data: users = [] } = useClinicUsers();

  const [patient, setPatient] = useState<{ id: string; name: string } | null>(
    prefilledPatient ?? null
  );

  // Reset prefilled patient every time the modal opens
  useEffect(() => {
    if (dateStr && prefilledPatient) setPatient(prefilledPatient);
    if (!dateStr) setPatient(prefilledPatient ?? null);
  }, [dateStr]);
  const [dentistId, setDentistId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Pre-fill date/time when the modal opens from a calendar click
  useEffect(() => {
    if (!dateStr) return;
    setDate(dateStr.slice(0, 10));
    const timePart = dateStr.length > 10 ? dateStr.slice(11, 16) : "09:00";
    setTime(timePart);
  }, [dateStr]);

  // Pre-fill dentist with current user
  useEffect(() => {
    if (user && !dentistId) setDentistId(user.id);
  }, [user, dentistId]);

  const dentistOptions = [
    { value: "", label: "Seleccionar dentista..." },
    ...(users.length > 0
      ? users.map((u) => ({ value: u.id, label: u.full_name }))
      : user
      ? [{ value: user.id, label: user.full_name }]
      : []),
  ];

  const dateLabel = date
    ? format(new Date(date + "T12:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
    : "";

  const create = useCreateAppointment(onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !dentistId || !date || !time || !type) return;

    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();

    create.mutate({
      patient_id: patient.id,
      dentist_id: dentistId,
      scheduled_at,
      duration_minutes: parseInt(duration),
      appointment_type: type,
      reason: reason || null,
      notes: notes || null,
    });
  }

  const isValid = !!patient && !!dentistId && !!date && !!time && !!type;

  return (
    <Modal open={!!dateStr} onClose={onClose} title="Nueva cita" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Patient */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Paciente *
          </label>
          <PatientSearch value={patient} onChange={setPatient} />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="Fecha *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            {dateLabel && (
              <p className="mt-1 text-xs capitalize text-slate-400">{dateLabel}</p>
            )}
          </div>
          <Input
            label="Hora *"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        {/* Dentist & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Dentista *"
            value={dentistId}
            onChange={(e) => setDentistId(e.target.value)}
            options={dentistOptions}
          />
          <Select
            label="Duración *"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            options={DURATION_OPTIONS}
          />
        </div>

        {/* Type */}
        <Select
          label="Tipo de cita *"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={TYPE_OPTIONS}
        />

        {/* Reason & Notes */}
        <Input
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Dolor molar superior..."
        />
        <Textarea
          label="Notas internas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Indicaciones adicionales..."
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!isValid}>
            Crear cita
          </Button>
        </div>
      </form>
    </Modal>
  );
}
