"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { differenceInYears, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  Pencil,
  UserX,
  Trash2,
  Phone,
  AlertTriangle,
  Star,
  Droplets,
  ClipboardList,
  Camera,
  CalendarDays,
  ChevronRight,
  ScanLine,
  Banknote,
  X,
} from "lucide-react";
import { usePatient, useDeactivatePatient, useDeletePatientPermanent } from "@/hooks/usePatients";
import { useCreateTransaction, useExchangeRate } from "@/hooks/useFinances";
import {
  REWARDS_LEVEL_LABELS,
  REWARDS_LEVEL_COLORS,
  GENDER_LABELS,
  RewardsLevel,
} from "@/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

const today = new Date().toISOString().split("T")[0];

function QuickPaymentModal({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
}) {
  const now = new Date();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [description, setDescription] = useState("Pago de tratamiento");
  const [date, setDate] = useState(today);
  const { data: exchangeRate = 37 } = useExchangeRate();
  const create = useCreateTransaction(now.getFullYear(), now.getMonth() + 1);

  const amountNIO =
    currency === "USD" && amount
      ? parseFloat(amount) * exchangeRate
      : parseFloat(amount || "0");

  function fmt(n: number) {
    return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2 }).format(n);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    create.mutate(
      {
        type: "ingreso",
        category: "pago_tratamiento",
        description: description.trim() || "Pago de tratamiento",
        original_amount: parseFloat(amount),
        original_currency: currency,
        transaction_date: date,
        patient_id: patientId,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-green-600 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Registrar pago</h2>
            <p className="text-xs text-green-100 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amount + currency */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Monto recibido *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "NIO" | "USD")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="NIO">C$</option>
                <option value="USD">USD</option>
              </select>
            </div>
            {currency === "USD" && amount && (
              <p className="mt-1 text-xs text-slate-400">
                ≈ C$ {fmt(amountNIO)} (tasa: {fmt(exchangeRate)})
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <p className="text-xs text-slate-400">
            Puedes editar los detalles completos desde el módulo de Finanzas.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending || !amount || parseFloat(amount) <= 0}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {create.isPending ? "Registrando…" : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(id);
  const deactivate = useDeactivatePatient();
  const deletePermanent = useDeletePatientPermanent();
  const [showPayment, setShowPayment] = useState(false);

  function handleDeactivate() {
    if (
      window.confirm(
        `¿Desactivar a ${patient?.full_name}? Seguirá en el sistema pero no aparecerá en la lista activa.`
      )
    ) {
      deactivate.mutate(id);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Paciente no encontrado.
        <Link href="/patients" className="ml-2 text-blue-600 hover:underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const patientAge = patient.date_of_birth
    ? `${differenceInYears(new Date(), parseISO(patient.date_of_birth))} años`
    : null;

  const dobFormatted = patient.date_of_birth
    ? format(parseISO(patient.date_of_birth), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null;

  const firstVisit = patient.first_visit_date
    ? format(parseISO(patient.first_visit_date), "MMM yyyy", { locale: es })
    : null;

  const initials = patient.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const avatarColor = patient.rewards?.level
    ? ({
        starter: "bg-slate-200 text-slate-600",
        bronze: "bg-amber-100 text-amber-700",
        silver: "bg-gray-200 text-gray-600",
        gold: "bg-yellow-100 text-yellow-700",
        diamond: "bg-violet-100 text-violet-700",
      }[patient.rewards.level] ?? "bg-blue-100 text-blue-700")
    : "bg-blue-100 text-blue-700";

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChevronLeft size={16} />
        Pacientes
      </Link>

      {/* Patient header */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold ${avatarColor}`}
            >
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{patient.full_name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {patient.rewards?.level && (
                  <Badge
                    label={`★ ${REWARDS_LEVEL_LABELS[patient.rewards.level as RewardsLevel]}`}
                    className={REWARDS_LEVEL_COLORS[patient.rewards.level as RewardsLevel]}
                  />
                )}
                <Badge
                  label={patient.is_active ? "Activo" : "Inactivo"}
                  className={
                    patient.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }
                />
                {patientAge && (
                  <span className="text-sm text-slate-500">{patientAge}</span>
                )}
                {firstVisit && (
                  <span className="text-sm text-slate-400">
                    · Primera visita: {firstVisit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowPayment(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <Banknote size={14} />
              Registrar pago
            </button>
            <Link href={`/patients/${id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={14} />
                Editar
              </Button>
            </Link>
            {patient.is_active && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:bg-red-50"
                onClick={handleDeactivate}
                loading={deactivate.isPending}
              >
                <UserX size={14} />
                Desactivar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-700 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(`¿Eliminar permanentemente a ${patient.full_name}? Esta acción no se puede deshacer.\n\nSi tiene registros vinculados se mostrará un error; usa "Desactivar" en ese caso.`)) {
                  deletePermanent.mutate(id);
                }
              }}
              loading={deletePermanent.isPending}
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Link
          href={`/patients/${id}/appointments`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays size={18} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Citas</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/treatments`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <ClipboardList size={18} className="text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Tratamientos</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/photos`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
              <Camera size={18} className="text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Fotografías</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/rewards`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-yellow-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-50">
              <Star size={18} className="text-yellow-500" />
            </div>
            <span className="text-sm font-medium text-slate-700">Smile Rewards</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/odontogram`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-teal-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
              <ScanLine size={18} className="text-teal-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Odontograma</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
      </div>

      {/* Info cards grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Personal */}
        <InfoCard title="Datos personales" icon={Star}>
          <InfoRow label="Nombre completo" value={patient.full_name} />
          <InfoRow
            label="Fecha de nacimiento"
            value={dobFormatted ? `${dobFormatted}${patientAge ? ` (${patientAge})` : ""}` : null}
          />
          <InfoRow
            label="Género"
            value={patient.gender ? GENDER_LABELS[patient.gender] : null}
          />
          <InfoRow label="Cédula / Documento" value={patient.id_number} />
        </InfoCard>

        {/* Contact */}
        <InfoCard title="Contacto" icon={Phone}>
          <InfoRow label="Teléfono" value={patient.phone} />
          <InfoRow label="Teléfono alternativo" value={patient.phone_secondary} />
          <InfoRow label="Correo" value={patient.email} />
          <InfoRow label="Dirección" value={patient.address} />
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Emergencia</p>
            <InfoRow label="Nombre" value={patient.emergency_contact_name} />
            <InfoRow label="Teléfono" value={patient.emergency_contact_phone} />
          </div>
        </InfoCard>

        {/* Medical */}
        <InfoCard title="Información médica" icon={Droplets}>
          <InfoRow label="Tipo de sangre" value={patient.blood_type} />
          {patient.allergies && (
            <div>
              <p className="mb-1 text-xs text-slate-400">Alergias</p>
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {patient.allergies}
              </p>
            </div>
          )}
          <InfoRow label="Condiciones médicas" value={patient.medical_conditions} />
          <InfoRow label="Medicamentos" value={patient.current_medications} />
        </InfoCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Notes */}
        {patient.notes && (
          <InfoCard title="Notas internas" icon={AlertTriangle}>
            <p className="text-sm text-slate-700 whitespace-pre-line">{patient.notes}</p>
          </InfoCard>
        )}

        {/* Rewards summary */}
        {patient.rewards && (
          <InfoCard title="Smile Rewards" icon={Star}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Nivel actual</p>
                <Badge
                  label={REWARDS_LEVEL_LABELS[patient.rewards.level as RewardsLevel]}
                  className={`mt-1 ${REWARDS_LEVEL_COLORS[patient.rewards.level as RewardsLevel]}`}
                />
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Puntos acumulados</p>
                <p className="text-2xl font-bold text-slate-800">
                  {patient.rewards.total_points.toLocaleString("es-NI")}
                </p>
              </div>
            </div>
            {patient.rewards.benefits_suspended && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Beneficios suspendidos por inactividad mayor a 12 meses.
              </div>
            )}
          </InfoCard>
        )}
      </div>

      {showPayment && (
        <QuickPaymentModal
          patientId={id}
          patientName={patient.full_name}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
