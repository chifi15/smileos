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
  NotebookPen,
  History,
} from "lucide-react";
import { usePatient, useDeactivatePatient, useDeletePatientPermanent } from "@/hooks/usePatients";
import { useCreateTransaction, useExchangeRate, useDoctors } from "@/hooks/useFinances";
import { useCostTreatments, useCostProducts, type ApiTreatment } from "@/hooks/useCostos";
import { useRewardsConfig } from "@/hooks/useRewards";
import { useClinicFeatures } from "@/hooks/useSettings";
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

type UsedMaterial = { productId: string; qty: number; altGroup?: string | null };

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
  const [displayDate, setDisplayDate] = useState(() => {
    const [y, m, d] = today.split("-");
    return `${d}/${m}/${y}`;
  });
  const [ctId, setCtId] = useState("");
  const [aptId, setAptId] = useState("");
  const [usedMaterials, setUsedMaterials] = useState<UsedMaterial[] | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [doctorId, setDoctorId] = useState("");

  const { data: exchangeRate = 37 } = useExchangeRate();
  const { data: treatments = [] } = useCostTreatments();
  const { data: products = [] } = useCostProducts();
  const { data: doctors = [] } = useDoctors();
  const create = useCreateTransaction(now.getFullYear(), now.getMonth() + 1);

  const treatment: ApiTreatment | null = treatments.find((t) => t.id === ctId) ?? null;
  const isMultiApt = (treatment?.appointments.length ?? 0) > 1;

  const amountNIO =
    currency === "USD" && amount
      ? parseFloat(amount) * exchangeRate
      : parseFloat(amount || "0");

  function fmt(n: number) {
    return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2 }).format(n);
  }

  function autoSelectAltGroups(mats: UsedMaterial[]): UsedMaterial[] {
    const seen = new Set<string>();
    const result: UsedMaterial[] = [];
    for (const m of mats) {
      if (m.altGroup) {
        if (seen.has(m.altGroup)) continue;
        seen.add(m.altGroup);
      }
      result.push(m);
    }
    return result;
  }

  function calcMatCost(mats: UsedMaterial[]): number {
    return mats.reduce((sum, m) => {
      const p = products.find((pr) => pr.id === m.productId);
      const unitCost = p?.total_cost ?? p?.unit_price ?? 0;
      return sum + unitCost * m.qty;
    }, 0);
  }

  function loadMaterials(treatId: string, appointmentId: string) {
    const t = treatments.find((tr) => tr.id === treatId);
    if (!t) { setUsedMaterials(null); return; }
    const apt =
      t.appointments.find((a) => a.id === appointmentId) ??
      (t.appointments.length === 1 ? t.appointments[0] : null);
    if (!apt) { setUsedMaterials(null); return; }
    setUsedMaterials(apt.materials.map((m) => ({ productId: m.productId, qty: m.quantity, altGroup: m.altGroup ?? null })));
  }

  function handleTreatmentChange(id: string) {
    setCtId(id);
    setAptId("");
    setUsedMaterials(null);
    if (id) {
      const t = treatments.find((tr) => tr.id === id);
      if (t) {
        setDescription(t.name);
        if (t.appointments.length === 1) {
          loadMaterials(id, t.appointments[0].id);
        }
      }
    } else {
      setDescription("Pago de tratamiento");
    }
  }

  function handleDateInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length >= 3) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length >= 5) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
    setDisplayDate(formatted);
    if (digits.length === 8) {
      const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
      const parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (
        parsed.getFullYear() === parseInt(y) &&
        parsed.getMonth() === parseInt(m) - 1 &&
        parsed.getDate() === parseInt(d)
      ) {
        setDate(`${y}-${m}-${d}`);
      }
    }
  }

  function handleAptChange(id: string) {
    setAptId(id);
    setUsedMaterials(null);
    if (id && ctId) loadMaterials(ctId, id);
  }

  // Cost preview
  const resolvedForPreview = usedMaterials ? autoSelectAltGroups(usedMaterials) : null;
  const qty = Math.max(1, parseInt(quantity) || 1);
  let costLabel: React.ReactNode = null;

  if (treatment) {
    const marginPct = treatment.clinic_margin_pct ?? 0;
    const profFees = (treatment.professional_fee_per_hour || 0) * (treatment.total_hours || 0);
    const fixedCosts = treatment.fixed_costs || 0;
    const totalApts = treatment.appointments.length || 1;
    const matCost = resolvedForPreview !== null ? calcMatCost(resolvedForPreview) : 0;
    const honDisplay = profFees * qty;
    const fixedDisplay = fixedCosts * totalApts * qty;
    const rawCost = matCost + honDisplay + fixedDisplay;
    const ganancia = rawCost * marginPct;
    const costPreview = Math.round((rawCost + ganancia) * 100) / 100;
    costLabel = (
      <span className="flex flex-wrap gap-x-1 items-center text-xs">
        {matCost > 0 && <><span>Mat. <strong>C${fmt(matCost)}</strong></span><span className="text-slate-400">+</span></>}
        <span>Hon. <strong>C${fmt(honDisplay)}</strong></span>
        <span className="text-slate-400">+</span>
        <span>C.Fijos <strong>C${fmt(fixedDisplay)}</strong></span>
        {marginPct > 0 && <><span className="text-slate-400">+</span><span className="text-emerald-600">Gan. <strong>C${fmt(ganancia)}</strong></span></>}
        <span className="text-slate-400">=</span>
        <strong>C${fmt(costPreview)}</strong>
      </span>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    const qtyVal = Math.max(1, parseInt(quantity) || 1);
    create.mutate(
      {
        type: "ingreso",
        category: "pago_tratamiento",
        description: description.trim() || "Pago de tratamiento",
        original_amount: parseFloat(amount),
        original_currency: currency,
        transaction_date: date,
        patient_id: patientId,
        doctor_id: doctorId || undefined,
        ...(ctId && {
          cost_treatment_id: ctId,
          cost_appointment_id: aptId || undefined,
          quantity: qtyVal,
          deducted_materials: usedMaterials !== null
            ? usedMaterials.map((m) => ({ productId: m.productId, qty: m.qty, altGroup: m.altGroup ?? null }))
            : undefined,
        }),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between rounded-t-2xl bg-green-600 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Registrar pago</h2>
            <p className="text-xs text-green-100 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Amount + currency */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
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
                className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "NIO" | "USD")}
                className="rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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

          {/* Treatment selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
              Tratamiento (costo operativo)
            </label>
            <select
              value={ctId}
              onChange={(e) => handleTreatmentChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— Sin tratamiento —</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Appointment selector (multi-apt treatments only) */}
          {isMultiApt && treatment && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
                Cita
              </label>
              <select
                value={aptId}
                onChange={(e) => handleAptChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Seleccionar cita —</option>
                {treatment.appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Cita {a.number}: {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cost preview */}
          {costLabel && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-amber-800 dark:text-amber-200">
              <p className="text-[10px] font-medium mb-0.5 text-amber-600">Costo operativo estimado:</p>
              {costLabel}
            </div>
          )}

          {/* Materials list */}
          {usedMaterials !== null && usedMaterials.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
                Materiales utilizados
              </label>
              <div className="space-y-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-gray-600 p-2">
                {usedMaterials.map((m, i) => {
                  const p = products.find((pr) => pr.id === m.productId);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate text-slate-700 dark:text-gray-300">
                        {p?.name ?? m.productId}
                        {m.altGroup && <span className="ml-1 text-slate-400">[alt]</span>}
                      </span>
                      <span className="text-slate-400 shrink-0">×{m.qty}</span>
                      <button
                        type="button"
                        onClick={() => setUsedMaterials((prev) => prev ? prev.filter((_, j) => j !== i) : prev)}
                        className="text-red-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">
              Doctor que realizó el procedimiento
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— Sin asignar —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date — typed input DD/MM/AAAA */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fecha
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={displayDate}
              onChange={(e) => handleDateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <p className="text-xs text-slate-400">
            Puedes editar los detalles completos desde el módulo de Finanzas.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
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
      <span className="text-xs text-slate-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-slate-800 dark:text-gray-200">{value ?? "—"}</span>
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
    <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-slate-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-slate-400 dark:text-gray-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}


export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(id);
  const { data: rewardsConfig } = useRewardsConfig();
  const { data: features } = useClinicFeatures();
  const rewardsEnabled = features?.includes("rewards") ?? false;
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
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition-colors"
      >
        <ChevronLeft size={16} />
        Pacientes
      </Link>

      {/* Patient header */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold ${avatarColor}`}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{patient.full_name}</h1>
                {patient.patient_number && (
                  <span className="text-sm font-mono font-semibold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded">
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Link
          href={`/patients/${id}/evolution`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-violet-200 dark:hover:border-violet-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <NotebookPen size={18} className="text-violet-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Evolución</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/appointments`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays size={18} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Citas</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/treatments`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <ClipboardList size={18} className="text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Tratamientos</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/photos`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
              <Camera size={18} className="text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Fotografías</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        {rewardsEnabled && (
          <Link
            href={`/patients/${id}/rewards`}
            className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-yellow-200 dark:hover:border-yellow-700 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-50">
                <Star size={18} className="text-yellow-500" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Smile Rewards</span>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </Link>
        )}
        <Link
          href={`/patients/${id}/odontogram`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-teal-200 dark:hover:border-teal-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
              <ScanLine size={18} className="text-teal-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Odontograma</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </Link>
        <Link
          href={`/patients/${id}/history`}
          className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-slate-300 dark:hover:border-gray-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
              <History size={18} className="text-slate-500" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Historia</span>
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
          <InfoRow label="Profesión" value={patient.occupation} />
        </InfoCard>

        {/* Contact */}
        <InfoCard title="Contacto" icon={Phone}>
          <InfoRow label="Teléfono" value={patient.phone} />
          <InfoRow label="Teléfono alternativo" value={patient.phone_secondary} />
          <InfoRow label="Correo" value={patient.email} />
          <InfoRow label="Dirección" value={patient.address} />
          <InfoRow label="Ciudad" value={patient.city} />
          <InfoRow label="País" value={patient.country} />
          <div className="border-t border-slate-100 dark:border-gray-700 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-gray-400">Emergencia</p>
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
        {rewardsEnabled && patient.rewards && (() => {
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
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                    {patient.rewards.total_points.toLocaleString("es-NI")}
                  </p>
                </div>
              </div>

              {/* Beneficios del nivel actual */}
              {levelData && (levelData.discount_pct > 0 || levelData.perks.length > 0) && (
                <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 px-3 py-2.5 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">Beneficios del nivel</p>
                  {levelData.discount_pct > 0 && (
                    <p className="text-xs font-bold text-green-700">
                      {levelData.discount_pct}% de descuento en tratamientos
                    </p>
                  )}
                  {levelData.perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-green-500 shrink-0 text-xs mt-0.5">✓</span>
                      <span className="text-xs text-slate-600 dark:text-gray-300">{perk}</span>
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
