"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Plus, Trash2, Play, CheckCircle2, XCircle, ScanLine, RotateCcw, Wallet, X } from "lucide-react";
import { usePlan, useDeleteItem, useStartItem, useCancelItem, useUpdatePlan, useReopenItem, usePlanPayments, useCreatePayment, useDeletePayment } from "@/hooks/useTreatments";
import { usePatient } from "@/hooks/usePatients";
import AddItemModal from "@/components/treatments/AddItemModal";
import CompleteItemModal from "@/components/treatments/CompleteItemModal";
import ImportFromOdontogramModal from "@/components/treatments/ImportFromOdontogramModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import {
  TreatmentPlanStatus,
  TreatmentItemStatus,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_COLORS,
  ITEM_STATUS_LABELS,
  ITEM_STATUS_COLORS,
} from "@/types";
import { cn } from "@/lib/utils";

const todayISO = new Date().toISOString().split("T")[0];

function fmt(n: number) {
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2 }).format(n);
}

function AddPaymentModal({
  patientId,
  planId,
  onClose,
}: {
  patientId: string;
  planId: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState("");
  const create = useCreatePayment(patientId, planId, onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    create.mutate({ amount: n, payment_date: date, notes: notes.trim() || undefined });
  }

  return (
    <Modal open onClose={onClose} title="Registrar abono" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Monto (C$)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Nota (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Primer abono, efectivo..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Guardar abono
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const PRIORITY_COLORS = {
  normal: "text-slate-400",
  urgent: "text-red-500",
};

interface CompleteTarget {
  itemId: string;
  procedureName: string | null;
}

export default function TreatmentPlanDetailPage() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>();
  const { data: patient } = usePatient(patientId);
  const { data: plan, isLoading } = usePlan(patientId, planId);
  const { data: payments = [] } = usePlanPayments(patientId, planId);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);

  const deleteItem = useDeleteItem(patientId, planId);
  const startItem = useStartItem(patientId, planId);
  const cancelItem = useCancelItem(patientId, planId);
  const reopenItem = useReopenItem(patientId, planId);
  const updatePlan = useUpdatePlan(patientId, planId);
  const deletePayment = useDeletePayment(patientId, planId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">Plan no encontrado.</div>
    );
  }

  const totalPrice = plan.items.reduce((s, i) => s + (i.quoted_price ?? 0), 0);
  const doneCount = plan.items.filter((i) => i.status === "completed").length;
  const pct = plan.items.length > 0 ? Math.round((doneCount / plan.items.length) * 100) : 0;

  const totalAbonado = payments.reduce((s, p) => s + p.amount, 0);
  const saldo = totalPrice - totalAbonado;
  const pctPago = totalPrice > 0 ? Math.min(100, Math.round((totalAbonado / totalPrice) * 100)) : 0;

  const statusOptions = [
    { value: "active", label: "Activo" },
    { value: "on_hold", label: "En espera" },
    { value: "abandoned", label: "Abandonado" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/patients/${patientId}/treatments`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
        >
          <ChevronLeft size={16} />
          {patient?.full_name ?? "Paciente"}
        </Link>
      </div>

      {/* Plan header */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{plan.title}</h1>
              <Badge
                label={PLAN_STATUS_LABELS[plan.status as TreatmentPlanStatus]}
                className={PLAN_STATUS_COLORS[plan.status as TreatmentPlanStatus]}
              />
            </div>
            {plan.diagnosis && (
              <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{plan.diagnosis}</p>
            )}
            {plan.notes && (
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500 italic">{plan.notes}</p>
            )}
            <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
              Creado {format(parseISO(plan.created_at), "d 'de' MMMM yyyy", { locale: es })}
              {plan.created_by && ` por ${plan.created_by.full_name}`}
            </p>
          </div>
          {plan.status !== "completed" && (
            <div className="w-40 shrink-0">
              <Select
                value={plan.status as string}
                onChange={(e) =>
                  updatePlan.mutate({ status: e.target.value as "active" | "on_hold" | "abandoned" })
                }
                options={statusOptions}
              />
            </div>
          )}
        </div>

        {/* Progress */}
        {plan.items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-500 dark:text-gray-400">{doneCount}/{plan.items.length} completados</span>
              <span className="font-medium text-slate-700 dark:text-gray-300">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {totalPrice > 0 && (
              <p className="mt-2 text-right text-sm font-medium text-slate-600 dark:text-gray-400">
                Total cotizado: C$ {totalPrice.toLocaleString("es-NI", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Procedimientos</h2>
          {plan.status === "active" && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
                <ScanLine size={15} />
                Desde odontograma
              </Button>
              <Button size="sm" onClick={() => setShowAddItem(true)}>
                <Plus size={15} />
                Agregar
              </Button>
            </div>
          )}
        </div>

        {plan.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-400 dark:text-gray-500">
            <p className="text-sm">No hay procedimientos en este plan.</p>
            {plan.status === "active" && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
                  <ScanLine size={15} />
                  Desde odontograma
                </Button>
                <Button size="sm" onClick={() => setShowAddItem(true)}>
                  Agregar procedimiento
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {plan.items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => {
                const status = item.status as TreatmentItemStatus;
                const canAct = plan.status === "active";
                const isWorking =
                  deleteItem.isPending || startItem.isPending || cancelItem.isPending || reopenItem.isPending;

                return (
                  <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                    {/* Status indicator */}
                    <div className="mt-0.5">
                      {status === "completed" ? (
                        <CheckCircle2 size={18} className="text-green-500" />
                      ) : status === "cancelled" ? (
                        <XCircle size={18} className="text-slate-300" />
                      ) : status === "in_progress" ? (
                        <Play size={18} className="text-amber-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 mt-0.5" />
                      )}
                    </div>

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            status === "cancelled"
                              ? "text-slate-400 dark:text-gray-600 line-through"
                              : "text-slate-800 dark:text-white"
                          )}
                        >
                          {item.procedure_name}
                        </span>
                        {item.procedure_code && (
                          <span className="text-xs text-slate-400">({item.procedure_code})</span>
                        )}
                        {item.priority === "urgent" && (
                          <Badge label="Urgente" className="bg-red-100 text-red-600" />
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-gray-400">
                        {item.tooth_fdi && <span>Diente {item.tooth_fdi}</span>}
                        {item.quoted_price != null && (
                          <span>
                            C$ {item.quoted_price.toLocaleString("es-NI", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        <Badge
                          label={ITEM_STATUS_LABELS[status]}
                          className={ITEM_STATUS_COLORS[status]}
                        />
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-slate-400">{item.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {(canAct || ["completed", "cancelled"].includes(status)) && (
                      <div className="flex shrink-0 gap-1">
                        {status === "pending" && (
                          <button
                            title="Iniciar"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                            onClick={() => startItem.mutate({ itemId: item.id })}
                            disabled={isWorking}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {status === "in_progress" && (
                          <button
                            title="Completar"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                            onClick={() =>
                              setCompleteTarget({
                                itemId: item.id,
                                procedureName: item.procedure_name,
                              })
                            }
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {!["completed", "cancelled"].includes(status) && (
                          <button
                            title="Cancelar ítem"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            onClick={() => cancelItem.mutate({ itemId: item.id })}
                            disabled={isWorking}
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        {["completed", "cancelled"].includes(status) && (
                          <button
                            title="Reabrir (volver a pendiente)"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => reopenItem.mutate({ itemId: item.id })}
                            disabled={isWorking}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          title="Eliminar"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          onClick={() => {
                            if (window.confirm("¿Eliminar este procedimiento del plan?")) {
                              deleteItem.mutate(item.id);
                            }
                          }}
                          disabled={isWorking}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Abonos */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Seguimiento de abonos</h2>
          </div>
          <Button size="sm" onClick={() => setShowAddPayment(true)}>
            <Plus size={15} />
            Nuevo abono
          </Button>
        </div>

        {/* Resumen financiero */}
        {totalPrice > 0 && (
          <div className="px-5 pt-4 pb-3 border-b border-slate-50 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Total del plan</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">C$ {fmt(totalPrice)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Total abonado</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">C$ {fmt(totalAbonado)}</p>
              </div>
              <div className={cn("rounded-lg p-3 text-center", saldo <= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20")}>
                <p className={cn("text-xs mb-0.5", saldo <= 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
                  {saldo <= 0 ? "Saldado" : "Saldo pendiente"}
                </p>
                <p className={cn("text-sm font-semibold", saldo <= 0 ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300")}>
                  C$ {fmt(Math.max(0, saldo))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-gray-700">
                <div
                  className={cn("h-2 rounded-full transition-all", pctPago >= 100 ? "bg-green-500" : "bg-emerald-500")}
                  style={{ width: `${pctPago}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-gray-400 w-8 text-right">{pctPago}%</span>
            </div>
          </div>
        )}

        {/* Lista de abonos */}
        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400 dark:text-gray-500">
            <p className="text-sm">No hay abonos registrados aún.</p>
            <Button size="sm" variant="secondary" onClick={() => setShowAddPayment(true)}>
              Registrar primer abono
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {payments.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      C$ {fmt(p.amount)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-gray-500">
                      {format(parseISO(p.payment_date), "d 'de' MMMM yyyy", { locale: es })}
                    </span>
                  </div>
                  {p.notes && (
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{p.notes}</p>
                  )}
                </div>
                <button
                  title="Eliminar abono"
                  className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                  onClick={() => {
                    if (window.confirm("¿Eliminar este abono?")) {
                      deletePayment.mutate(p.id);
                    }
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ImportFromOdontogramModal
        open={showImport}
        onClose={() => setShowImport(false)}
        patientId={patientId}
        planId={planId}
      />
      <AddItemModal
        open={showAddItem}
        onClose={() => setShowAddItem(false)}
        patientId={patientId}
        planId={planId}
      />
      <CompleteItemModal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        patientId={patientId}
        planId={planId}
        itemId={completeTarget?.itemId ?? ""}
        procedureName={completeTarget?.procedureName ?? null}
      />
      {showAddPayment && (
        <AddPaymentModal
          patientId={patientId}
          planId={planId}
          onClose={() => setShowAddPayment(false)}
        />
      )}
    </div>
  );
}
