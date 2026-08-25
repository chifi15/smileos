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
import { useGcalEventColors, GCAL_COLOR_NAMES } from "@/hooks/useCalendar";
import { APPOINTMENT_TYPE_LABELS, AppointmentType } from "@/types";

interface Props {
  dateStr: string | null;
  onClose: () => void;
  prefilledPatient?: { id: string; name: string };
}

const TYPE_OPTIONS = [
  { value: "", label: "Seleccionar tipo..." },
  ...(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentType[]).map((k) => ({
    value: k,
    label: APPOINTMENT_TYPE_LABELS[k],
  })),
];

function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function NewAppointmentModal({ dateStr, onClose, prefilledPatient }: Props) {
  const { user } = useAuthStore();
  const { data: users = [] } = useClinicUsers();
  const { data: gcalColors = {} } = useGcalEventColors();

  const [patient, setPatient] = useState<{ id: string; name: string } | null>(
    prefilledPatient ?? null
  );
  const [guestName, setGuestName] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [colorId, setColorId] = useState<string | null>(null);

  useEffect(() => {
    if (dateStr && prefilledPatient) setPatient(prefilledPatient);
    if (!dateStr) setPatient(prefilledPatient ?? null);
  }, [dateStr]);

  useEffect(() => {
    if (!dateStr) return;
    setDate(dateStr.slice(0, 10));
    const timePart = dateStr.length > 10 ? dateStr.slice(11, 16) : "09:00";
    setStartTime(timePart);
    setEndTime(addMinutes(timePart, 30));
  }, [dateStr]);

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

  const durationMinutes = timeDiffMinutes(startTime, endTime);
  const durationValid = durationMinutes >= 15;

  const create = useCreateAppointment(onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dentistId || !date || !startTime || !endTime || !type || !durationValid) return;
    if (!patient && !guestName.trim()) return;

    const scheduled_at = new Date(`${date}T${startTime}:00`).toISOString();

    create.mutate({
      patient_id: patient?.id ?? null,
      guest_name: patient ? null : guestName.trim(),
      dentist_id: dentistId,
      scheduled_at,
      duration_minutes: durationMinutes,
      appointment_type: type,
      reason: reason || null,
      notes: notes || null,
      gcal_color_id: colorId,
    });
  }

  const isValid = !!dentistId && !!date && !!startTime && !!endTime && !!type
    && durationValid && (!!patient || !!guestName.trim());

  return (
    <Modal open={!!dateStr} onClose={onClose} title="Nueva cita" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Patient */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
            Paciente <span className="text-slate-400 dark:text-gray-500 font-normal">(opcional)</span>
          </label>
          <PatientSearch value={patient} onChange={setPatient} />
        </div>

        {/* Guest name when no patient selected */}
        {!patient && (
          <Input
            label="Nombre del paciente"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Paciente nuevo sin registrar..."
            required
          />
        )}

        {/* Date */}
        <div>
          <Input
            label="Fecha *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {dateLabel && (
            <p className="mt-1 text-xs capitalize text-slate-400 dark:text-gray-500">{dateLabel}</p>
          )}
        </div>

        {/* Start / End time */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Hora inicio *"
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setEndTime(addMinutes(e.target.value, Math.max(durationMinutes, 30)));
            }}
            required
          />
          <div>
            <Input
              label="Hora fin *"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
            {durationMinutes > 0 && (
              <p className={`mt-1 text-xs ${durationValid ? "text-slate-400 dark:text-gray-500" : "text-red-500"}`}>
                {durationValid ? `${durationMinutes} min` : "Mínimo 15 min"}
              </p>
            )}
          </div>
        </div>

        {/* Dentist */}
        <Select
          label="Dentista *"
          value={dentistId}
          onChange={(e) => setDentistId(e.target.value)}
          options={dentistOptions}
        />

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

        {/* Color Google Calendar */}
        {Object.keys(gcalColors).length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">
              Color en Google Calendar
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setColorId(null)}
                title="Predeterminado"
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  colorId === null ? "border-blue-500 scale-125" : "border-slate-300 dark:border-gray-600"
                } bg-slate-200 dark:bg-gray-600`}
              />
              {Object.entries(gcalColors).map(([id, hex]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setColorId(id)}
                  title={GCAL_COLOR_NAMES[id] ?? id}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    colorId === id ? "border-blue-500 scale-125" : "border-transparent"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        )}

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
