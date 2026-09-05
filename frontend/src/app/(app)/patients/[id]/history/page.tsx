"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, History, FolderOpen, X,
  Receipt, TrendingUp, TrendingDown, User, Calendar,
  FileText, Stethoscope, DollarSign, Package, RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { usePatient } from "@/hooks/usePatients";
import { usePatientAudit } from "@/hooks/useAudit";
import { useTransaction, useCreateTransaction } from "@/hooks/useFinances";
import { useCostProducts, useUpdateCostProductStock } from "@/hooks/useCostos";
import Spinner from "@/components/ui/Spinner";
import type { AuditLog, AuditLogChanges, FinanceTransaction } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const RESOURCE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700",
  appointment: "bg-purple-100 text-purple-700",
  treatment_plan: "bg-indigo-100 text-indigo-700",
  treatment_item: "bg-cyan-100 text-cyan-700",
  odontogram: "bg-teal-100 text-teal-700",
  evolution: "bg-emerald-100 text-emerald-700",
  finance: "bg-green-100 text-green-700",
  reward: "bg-amber-100 text-amber-700",
  photo: "bg-pink-100 text-pink-700",
  settings: "bg-slate-100 text-slate-600",
  user: "bg-orange-100 text-orange-700",
};

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "Todo" },
  { value: "patient", label: "Datos" },
  { value: "appointment", label: "Citas" },
  { value: "treatment_plan", label: "Planes" },
  { value: "treatment_item", label: "Tratamientos" },
  { value: "odontogram", label: "Odontograma" },
  { value: "evolution", label: "Evoluciones" },
  { value: "finance", label: "Finanzas" },
  { value: "reward", label: "Rewards" },
  { value: "photo", label: "Fotos" },
];

const INCOME_CATEGORY_LABELS: Record<string, string> = {
  pago_tratamiento: "Pago de tratamiento",
  otro_ingreso: "Otro ingreso",
};
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  laboratorio: "Laboratorio dental",
  insumos: "Insumos y materiales",
  renta: "Renta",
  servicios: "Servicios",
  salario: "Salario / Honorarios",
  otro_egreso: "Otro egreso",
};

// ─── ChangesDiff ──────────────────────────────────────────────────────────────

function ChangesDiff({ changes }: { changes: AuditLogChanges }) {
  const lines: { label: string; type: "changed" | "added" | "removed" }[] = [];

  if (changes.patients_per_month) {
    lines.push({ label: `Pacientes/mes: ${changes.patients_per_month.from} → ${changes.patients_per_month.to}`, type: "changed" });
  }
  for (const c of changes.items_changed ?? []) {
    if (c.name_from && !("amount_from" in c)) {
      lines.push({ label: `Renombrado "${c.name_from}" → "${c.name}"`, type: "changed" });
    } else if (c.name_from && c.amount_from !== undefined && c.amount_to !== undefined) {
      lines.push({ label: `${c.name} (antes "${c.name_from}"): C$ ${fmt(c.amount_from)} → C$ ${fmt(c.amount_to)}`, type: "changed" });
    } else if (c.amount_from !== undefined && c.amount_to !== undefined) {
      lines.push({ label: `${c.name}: C$ ${fmt(c.amount_from)} → C$ ${fmt(c.amount_to)}`, type: "changed" });
    }
  }
  for (const c of changes.items_added ?? []) {
    lines.push({ label: `${c.name}: C$ ${fmt(c.amount)}`, type: "added" });
  }
  for (const c of changes.items_removed ?? []) {
    lines.push({ label: `${c.name}: C$ ${fmt(c.amount)}`, type: "removed" });
  }
  if (changes.name_from !== undefined && changes.name_to !== undefined) {
    lines.push({ label: `Nombre: "${changes.name_from}" → "${changes.name_to}"`, type: "changed" });
  }
  if (changes.price_from !== undefined && changes.price_to !== undefined) {
    const from = changes.price_from !== null ? `C$ ${fmt(changes.price_from)}` : "sin precio";
    const to   = changes.price_to   !== null ? `C$ ${fmt(changes.price_to)}`   : "sin precio";
    lines.push({ label: `Precio: ${from} → ${to}`, type: "changed" });
  }
  if (changes.operational_cost_from !== undefined && changes.operational_cost_to !== undefined) {
    const from = changes.operational_cost_from !== null ? `C$ ${fmt(changes.operational_cost_from)}` : "sin costo";
    const to   = changes.operational_cost_to   !== null ? `C$ ${fmt(changes.operational_cost_to)}`   : "sin costo";
    lines.push({ label: `Costo op.: ${from} → ${to}`, type: "changed" });
  }

  if (lines.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {lines.map((l, i) => (
        <li key={i} className="flex items-center gap-1.5 text-xs">
          {l.type === "changed" && <span className="text-amber-500 font-bold">~</span>}
          {l.type === "added"   && <span className="text-green-600 font-bold">+</span>}
          {l.type === "removed" && <span className="text-red-500 font-bold">−</span>}
          <span className={
            l.type === "changed" ? "text-slate-600 dark:text-gray-300" :
            l.type === "added"   ? "text-green-700 dark:text-green-400" :
                                   "text-red-600 dark:text-red-400"
          }>{l.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400 dark:text-gray-500 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-sm text-slate-700 dark:text-gray-200 break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ entry, onClose }: { entry: AuditLog; onClose: () => void }) {
  const isFinance = entry.resource_type === "finance";
  const isDeleted = entry.action === "finance.deleted";
  const snapshotTx = entry.changes?.snapshot ?? null;

  const { data: liveTx, isLoading } = useTransaction(
    isFinance && !isDeleted && entry.resource_id ? entry.resource_id : null
  );
  const { data: products = [] } = useCostProducts();
  const updateStock = useUpdateCostProductStock();

  const tx: FinanceTransaction | null = isFinance ? (liveTx ?? snapshotTx) : null;

  const txDate  = tx ? parseISO(tx.transaction_date) : null;
  const txYear  = txDate ? txDate.getFullYear()  : new Date().getFullYear();
  const txMonth = txDate ? txDate.getMonth() + 1 : new Date().getMonth() + 1;
  const restore = useCreateTransaction(txYear, txMonth);

  function handleRestore() {
    if (!tx) return;
    const payload = {
      type: tx.type as "ingreso" | "egreso",
      category: tx.category,
      description: tx.description,
      original_amount: tx.original_amount ?? tx.amount_cordobas,
      original_currency: (tx.original_currency ?? "NIO") as "NIO" | "USD",
      transaction_date: tx.transaction_date,
      patient_id: tx.patient?.id,
      procedure_id: tx.procedure?.id,
      cost_appointment_id: tx.cost_appointment_id ?? undefined,
      quantity: tx.procedure_quantity ?? 1,
      operational_cost_override: tx.operational_cost_snapshot ?? undefined,
      doctor_id: tx.doctor?.id ?? null,
      invoice_number: tx.invoice_number ?? undefined,
      notes: tx.notes ?? undefined,
      deducted_materials: tx.deducted_materials ?? undefined,
    };
    restore.mutate(payload, {
      onSuccess: () => {
        if (tx.deducted_materials && tx.deducted_materials.length > 0) {
          const procedureQty = tx.procedure_quantity ?? 1;
          for (const { productId, qty: usedPortions } of tx.deducted_materials) {
            const product = products.find((p) => p.id === productId);
            if (!product) continue;
            const deductQty = product.portion_qty
              ? usedPortions * product.portion_qty * procedureQty
              : usedPortions * procedureQty;
            updateStock.mutate({ id: productId, qty: -deductQty, operation: "add" });
          }
        }
        onClose();
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            {isFinance
              ? <Receipt size={18} className="text-green-600 dark:text-green-400" />
              : <FileText size={18} className="text-slate-500 dark:text-gray-400" />}
            <span className="font-semibold text-slate-800 dark:text-white text-sm">
              {isFinance ? "Detalle de transacción" : "Detalle del cambio"}
            </span>
            {isDeleted && (
              <span className="rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                Eliminada
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {isFinance ? (
            isLoading && !snapshotTx ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !tx ? (
              <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-8">
                No hay detalles disponibles para esta transacción.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Tipo y monto */}
                <div className="rounded-xl border border-slate-100 dark:border-gray-700 p-4 flex items-center gap-4">
                  <div className={`rounded-full p-2.5 ${tx.type === "ingreso" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                    {tx.type === "ingreso"
                      ? <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                      : <TrendingDown size={20} className="text-red-500 dark:text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">
                      {tx.type === "ingreso" ? "Ingreso" : "Egreso"} ·{" "}
                      {tx.type === "ingreso"
                        ? INCOME_CATEGORY_LABELS[tx.category] ?? tx.category
                        : EXPENSE_CATEGORY_LABELS[tx.category] ?? tx.category}
                    </p>
                    <p className={`text-2xl font-bold ${tx.type === "ingreso" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                      C$ {fmt(tx.amount_cordobas)}
                    </p>
                    {tx.original_currency !== "NIO" && tx.original_amount && (
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                        {tx.original_currency} {fmt(tx.original_amount)}
                        {tx.exchange_rate_used ? ` · TC ${fmt(tx.exchange_rate_used)}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Campos */}
                <div className="space-y-2.5">
                  <Row icon={<FileText size={14} />} label="Descripción" value={tx.description} />
                  <Row icon={<Calendar size={14} />} label="Fecha" value={format(parseISO(tx.transaction_date), "d 'de' MMMM yyyy", { locale: es })} />
                  {tx.patient && <Row icon={<User size={14} />} label="Paciente" value={tx.patient.full_name} />}
                  {tx.procedure && <Row icon={<Stethoscope size={14} />} label="Procedimiento" value={tx.procedure.name} />}
                  {tx.doctor && <Row icon={<User size={14} />} label="Doctor" value={tx.doctor.full_name} />}
                  {tx.operational_cost_snapshot != null && (
                    <Row icon={<DollarSign size={14} />} label="Costo operativo" value={`C$ ${fmt(tx.operational_cost_snapshot)}`} />
                  )}
                  {tx.invoice_number && <Row icon={<Receipt size={14} />} label="N° comprobante" value={tx.invoice_number} />}
                  {tx.notes && <Row icon={<FileText size={14} />} label="Notas" value={tx.notes} />}
                  {tx.created_by && <Row icon={<User size={14} />} label="Registrado por" value={tx.created_by.full_name} />}
                </div>

                {/* Materiales descontados */}
                {tx.deducted_materials && tx.deducted_materials.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Package size={13} /> Materiales descontados
                    </p>
                    <div className="rounded-lg border border-slate-100 dark:border-gray-700 divide-y divide-slate-50 dark:divide-gray-700 overflow-hidden">
                      {tx.deducted_materials.map((m) => {
                        const product = products.find((p) => p.id === m.productId);
                        return (
                          <div key={m.productId} className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs text-slate-700 dark:text-gray-300">
                              {product?.name ?? m.productId}
                              {product?.portion_description && (
                                <span className="text-slate-400 dark:text-gray-500 ml-1">/ {product.portion_description}</span>
                              )}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-gray-500">× {m.qty} {product?.presentation_unit ?? ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ajustes de inventario */}
                {entry.changes?.inventory_changes && entry.changes.inventory_changes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Package size={13} /> Ajustes de inventario
                    </p>
                    <div className="rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 divide-y divide-amber-100 dark:divide-amber-800 overflow-hidden">
                      {(entry.changes.inventory_changes as string[]).map((line, i) => (
                        <p key={i} className="px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Detalle para registros que no son finanzas */
            <div className="space-y-3">
              {entry.changes && !entry.changes.snapshot && (
                <div className="rounded-lg border border-slate-100 dark:border-gray-700 px-4 py-3">
                  <ChangesDiff changes={entry.changes} />
                </div>
              )}
            </div>
          )}

          {/* Auditoría — siempre visible */}
          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-gray-700/50 px-3 py-2.5 text-xs text-slate-400 dark:text-gray-500 space-y-0.5">
            <p>Evento: <span className="font-medium text-slate-600 dark:text-gray-300">{entry.description ?? entry.action}</span></p>
            <p>Módulo: <span className="font-medium text-slate-600 dark:text-gray-300">{entry.resource_type_label}</span></p>
            <p>Fecha: {format(parseISO(entry.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
            {entry.user && <p>Por: {entry.user.full_name}</p>}
          </div>
        </div>

        {/* Footer: restablecer transacción eliminada */}
        {isDeleted && tx && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-gray-700 flex justify-end shrink-0">
            <button
              type="button"
              onClick={handleRestore}
              disabled={restore.isPending}
              className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              <RotateCcw size={14} className={restore.isPending ? "animate-spin" : ""} />
              {restore.isPending ? "Restableciendo…" : "Restablecer transacción"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AuditEntry row ───────────────────────────────────────────────────────────

function AuditEntry({ entry, onClick }: { entry: AuditLog; onClick: (e: AuditLog) => void }) {
  const color = RESOURCE_COLORS[entry.resource_type] ?? "bg-slate-100 text-slate-600";
  const date = parseISO(entry.created_at);

  return (
    <div
      className="flex items-start gap-3 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-lg px-2 -mx-2 transition-colors"
      onClick={() => onClick(entry)}
    >
      <div className="mt-0.5 shrink-0">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
          {entry.resource_type_label}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 dark:text-white">{entry.description ?? entry.action}</p>
        {entry.changes && !entry.changes.snapshot && <ChangesDiff changes={entry.changes} />}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
          {entry.user && <span>{entry.user.full_name}</span>}
          {entry.user && <span>·</span>}
          <span>{format(date, "d MMM yyyy, HH:mm", { locale: es })}</span>
          <span className="ml-auto text-blue-500 dark:text-blue-400 text-[10px] font-medium">Ver detalles →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditLog | null>(null);

  const { data: patient, isLoading: loadingPatient } = usePatient(id);
  const { data, isLoading } = usePatientAudit(id, {
    resource_type: resourceType || undefined,
    page,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/patients/${id}`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={16} />
            {loadingPatient ? "Paciente" : patient?.full_name}
          </Link>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <History size={20} className="text-slate-400 dark:text-gray-500" />
            Historial de cambios
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Haz clic en cualquier registro para ver todos los detalles
          </p>
        </div>

        {/* Fecha de creación del expediente */}
        {patient && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 px-4 py-3">
            <FolderOpen size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-slate-700 dark:text-gray-300">
              <span className="font-medium">Expediente creado el </span>
              {format(parseISO(patient.created_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {RESOURCE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setResourceType(opt.value); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                resourceType === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">
              No hay cambios registrados para este paciente
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-gray-700 px-5">
              {entries.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} onClick={setSelectedEntry} />
              ))}
            </div>
          )}

          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-700 px-5 py-3">
              <span className="text-xs text-slate-400 dark:text-gray-500">
                {meta.total} registro{meta.total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-slate-600 dark:text-gray-400">
                  {page} / {meta.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                  disabled={page === meta.pages}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEntry && (
        <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </>
  );
}
