"use client";

import { useState, useEffect, useRef } from "react";
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
  NotebookPen,
  Users,
  Search,
} from "lucide-react";
import { usePatient, useDeactivatePatient, useDeletePatientPermanent, useSetReferral, usePatientSearch } from "@/hooks/usePatients";
import { useCreateTransaction, useExchangeRate } from "@/hooks/useFinances";
import { useRewardsConfig } from "@/hooks/useRewards";
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

// ─── Referral Section ─────────────────────────────────────────────────────────

interface ReferralSectionProps {
  patientId: string;
  currentReferrerId: string | null;
  currentReferrerName: string | null;
}

function ReferralSection({ patientId, currentReferrerId, currentReferrerName }: ReferralSectionProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; full_name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setReferral = useSetReferral(patientId, () => setOpen(false));
  const { data: results = [], isFetching } = usePatientSearch(query);

  // Filter out self
  const filtered = results.filter((p) => p.id !== patientId);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleConfirm() {
    if (!selected) return;
    setReferral.mutate(selected.id);
  }

  return (
    <>
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Referido por</h3>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {currentReferrerId ? "Cambiar" : "Asignar"}
          </button>
        </div>

        <div className="mt-3">
          {currentReferrerName && currentReferrerId ? (
            <Link
              href={`/patients/${currentReferrerId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xs font-bold shrink-0">
                {currentReferrerName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              {currentReferrerName}
            </Link>
          ) : (
            <p className="text-sm text-slate-400">Sin referidor asignado.</p>
          )}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Asignar referidor</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {currentReferrerId && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Este paciente ya tiene un referidor. Los puntos solo se otorgan la primera vez.
                </p>
              )}

              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                  placeholder="Buscar paciente por nombre..."
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Results */}
              {query.trim().length >= 2 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                  {isFetching ? (
                    <div className="py-4 text-center text-xs text-slate-400">Buscando...</div>
                  ) : filtered.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">Sin resultados.</div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          selected?.id === p.id
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        {p.full_name}
                        {p.phone && <span className="ml-2 text-xs text-slate-400">{p.phone}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected preview */}
              {selected && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    {selected.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-blue-700">{selected.full_name}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selected || setReferral.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {setReferral.isPending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(id);
  const { data: rewardsConfig } = useRewardsConfig();
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">{patient.full_name}</h1>
                {patient.patient_number && (
                  <span className="text-sm font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    #{String(patient.patient_number).padStart(3, "0")}
                  </span>
                )}
              </div>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Link
          href={`/patients/${id}/evolution`}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <NotebookPen size={18} className="text-violet-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Evolución</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
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
          <InfoRow label="Ciudad" value={patient.city} />
          <InfoRow label="País" value={patient.country} />
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
        {/* Chief complaint */}
        {patient.chief_complaint && (
          <InfoCard title="Motivo de consulta" icon={ClipboardList}>
            <p className="text-sm text-slate-700 whitespace-pre-line">{patient.chief_complaint}</p>
          </InfoCard>
        )}
        {/* Notes */}
        {patient.notes && (
          <InfoCard title="Notas internas" icon={AlertTriangle}>
            <p className="text-sm text-slate-700 whitespace-pre-line">{patient.notes}</p>
          </InfoCard>
        )}

        {/* Rewards summary */}
        {patient.rewards && (() => {
          const levelData = rewardsConfig?.level_thresholds.find(
            (l) => l.level === patient.rewards!.level
          );
          return (
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

              {/* Beneficios del nivel actual */}
              {levelData && (levelData.discount_pct > 0 || levelData.perks.length > 0) && (
                <div className="rounded-lg bg-slate-50 px-3 py-2.5 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500">Beneficios del nivel</p>
                  {levelData.discount_pct > 0 && (
                    <p className="text-xs font-bold text-green-700">
                      {levelData.discount_pct}% de descuento en tratamientos
                    </p>
                  )}
                  {levelData.perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-green-500 shrink-0 text-xs mt-0.5">✓</span>
                      <span className="text-xs text-slate-600">{perk}</span>
                    </div>
                  ))}
                </div>
              )}

              {patient.rewards.benefits_suspended && (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Beneficios suspendidos por inactividad mayor a 12 meses.
                </div>
              )}
            </InfoCard>
          );
        })()}
      </div>

      {/* Referral */}
      <ReferralSection
        patientId={id}
        currentReferrerId={patient.referred_by_patient_id}
        currentReferrerName={patient.referred_by_name}
      />

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
