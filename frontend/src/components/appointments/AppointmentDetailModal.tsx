"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, User, Stethoscope, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  AppointmentFull,
  AppointmentStatus,
  AppointmentType,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  REWARDS_LEVEL_LABELS,
  REWARDS_LEVEL_COLORS,
  RewardsLevel,
} from "@/types";
import {
  useConfirmAppointment,
  useStartAppointment,
  useCompleteAppointment,
  useNoShowAppointment,
  useCancelAppointment,
  useEditAppointment,
} from "@/hooks/useAppointments";
import { useClinicUsers } from "@/hooks/useUsers";

const durationOptions = [
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "75", label: "75 min" },
  { value: "90", label: "90 min" },
  { value: "120", label: "120 min" },
];

const appointmentTypeOptions = (
  Object.entries(APPOINTMENT_TYPE_LABELS) as [AppointmentType, string][]
).map(([value, label]) => ({ value, label }));

interface Props {
  appointment: AppointmentFull | null;
  onClose: () => void;
}

function formatTime(iso: string) {
  return format(parseISO(iso), "HH:mm");
}

function formatDate(iso: string) {
  return format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: es });
}

interface EditFormProps {
  appt: AppointmentFull;
  onCancel: () => void;
  onSuccess: () => void;
}

function EditForm({ appt, onCancel, onSuccess }: EditFormProps) {
  const localDt = parseISO(appt.scheduled_at);
  const [date, setDate] = useState(format(localDt, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(localDt, "HH:mm"));
  const [duration, setDuration] = useState(String(appt.duration_minutes));
  const [apptType, setApptType] = useState(appt.appointment_type);
  const [dentistId, setDentistId] = useState(appt.dentist_id);
  const [reason, setReason] = useState(appt.reason ?? "");
  const [notes, setNotes] = useState(appt.notes ?? "");

  const { data: users = [] } = useClinicUsers();
  const edit = useEditAppointment(onSuccess);

  const dentistOptions = users.map((u) => ({ value: u.id, label: u.full_name }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    edit.mutate({
      id: appt.id,
      body: {
        scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
        duration_minutes: Number(duration),
        appointment_type: apptType,
        dentist_id: dentistId,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Fecha *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="Hora *"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Duración"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          options={durationOptions}
        />
        <Select
          label="Tipo"
          value={apptType}
          onChange={(e) => setApptType(e.target.value as AppointmentType)}
          options={appointmentTypeOptions}
        />
      </div>
      {dentistOptions.length > 0 && (
        <Select
          label="Dentista"
          value={dentistId}
          onChange={(e) => setDentistId(e.target.value)}
          options={dentistOptions}
        />
      )}
      <Input
        label="Motivo"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo de la consulta"
      />
      <Textarea
        label="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Observaciones..."
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={edit.isPending} disabled={!date || !time}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

export default function AppointmentDetailModal({ appointment: appt, onClose }: Props) {
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const confirm = useConfirmAppointment(onClose);
  const start = useStartAppointment(onClose);
  const complete = useCompleteAppointment(onClose);
  const noShow = useNoShowAppointment(onClose);
  const cancel = useCancelAppointment(onClose);

  if (!appt) return null;

  const isWorking =
    confirm.isPending ||
    start.isPending ||
    complete.isPending ||
    noShow.isPending ||
    cancel.isPending;

  function handleCancel() {
    cancel.mutate({ id: appt!.id, reason: cancelReason || undefined });
    setShowCancel(false);
    setCancelReason("");
  }

  function handleClose() {
    setIsEditing(false);
    setShowCancel(false);
    setCancelReason("");
    onClose();
  }

  const status = appt.status as AppointmentStatus;
  const canAct = !["completed", "cancelled", "no_show"].includes(status);
  const canEdit = ["scheduled", "confirmed"].includes(status);

  return (
    <Modal
      open={!!appt}
      onClose={handleClose}
      title={isEditing ? "Editar cita" : "Detalle de cita"}
      size="md"
    >
      {isEditing ? (
        <EditForm
          appt={appt}
          onCancel={() => setIsEditing(false)}
          onSuccess={handleClose}
        />
      ) : (
        <>
          {/* Patient */}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{appt.patient_name}</h3>
              {appt.patient_rewards_level && (
                <Badge
                  label={`★ ${REWARDS_LEVEL_LABELS[appt.patient_rewards_level as RewardsLevel]}`}
                  className={`mt-1 ${REWARDS_LEVEL_COLORS[appt.patient_rewards_level as RewardsLevel]}`}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                label={APPOINTMENT_STATUS_LABELS[status]}
                className={APPOINTMENT_STATUS_COLORS[status]}
              />
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex items-center gap-3">
              <Clock size={15} className="shrink-0 text-slate-400" />
              <div>
                <span className="font-medium text-slate-700 capitalize">
                  {formatDate(appt.scheduled_at)}
                </span>
                <span className="text-slate-500">
                  {" "}· {formatTime(appt.scheduled_at)} – {formatTime(appt.end_at)}
                </span>
                <span className="ml-2 text-xs text-slate-400">({appt.duration_minutes} min)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Stethoscope size={15} className="shrink-0 text-slate-400" />
              <span className="text-slate-700">{appt.dentist_name}</span>
            </div>

            <div className="flex items-center gap-3">
              <User size={15} className="shrink-0 text-slate-400" />
              <span className="text-slate-700">
                {APPOINTMENT_TYPE_LABELS[appt.appointment_type]}
              </span>
            </div>

            {appt.reason && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-400 mb-0.5">Motivo</p>
                <p className="text-slate-700">{appt.reason}</p>
              </div>
            )}

            {appt.notes && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-400 mb-0.5">Notas</p>
                <p className="text-slate-700">{appt.notes}</p>
              </div>
            )}

            {appt.cancellation_reason && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-400 mb-0.5">Motivo de cancelación</p>
                <p className="text-red-600">{appt.cancellation_reason}</p>
              </div>
            )}
          </div>

          {/* Status actions */}
          {canAct && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {status === "scheduled" && (
                  <Button
                    size="sm"
                    onClick={() => confirm.mutate(appt.id)}
                    loading={confirm.isPending}
                    disabled={isWorking}
                  >
                    Confirmar
                  </Button>
                )}
                {status === "confirmed" && (
                  <Button
                    size="sm"
                    onClick={() => start.mutate(appt.id)}
                    loading={start.isPending}
                    disabled={isWorking}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    Iniciar consulta
                  </Button>
                )}
                {status === "in_progress" && (
                  <Button
                    size="sm"
                    onClick={() => complete.mutate(appt.id)}
                    loading={complete.isPending}
                    disabled={isWorking}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Completar
                  </Button>
                )}
                {["scheduled", "confirmed"].includes(status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => noShow.mutate(appt.id)}
                    loading={noShow.isPending}
                    disabled={isWorking}
                  >
                    No asistió
                  </Button>
                )}
              </div>

              {/* Cancel flow */}
              {!showCancel ? (
                <button
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                  onClick={() => setShowCancel(true)}
                >
                  Cancelar cita
                </button>
              ) : (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-3">
                  <Input
                    label="Motivo de cancelación (opcional)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Paciente solicitó cancelar..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleCancel}
                      loading={cancel.isPending}
                    >
                      Confirmar cancelación
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setShowCancel(false); setCancelReason(""); }}
                    >
                      Volver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
