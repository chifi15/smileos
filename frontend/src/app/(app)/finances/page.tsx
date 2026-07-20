"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Camera,
  FileImage,
  User,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import {
  useFinanceSummary,
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useBulkDeleteTransactions,
  useExchangeRate,
  useUpdateExchangeRate,
  useIncomeByPatient,
  usePatientTransactions,
  useUploadReceipt,
  useDeleteReceipt,
} from "@/hooks/useFinances";
import { useProcedures } from "@/hooks/useCatalog";
import { usePatientList } from "@/hooks/usePatients";
import {
  FinanceTransaction,
  FinanceType,
  FinanceCategory,
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  ALL_CATEGORY_LABELS,
  TransactionCreatePayload,
} from "@/types";

const MONTHS_ES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number) {
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, sub }: {
  label: string; value: number; color: string; sub?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">C$ {fmt(value)}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Patient Select ────────────────────────────────────────────────────────────

interface PatientRef { id: string; name: string }

function PatientSelect({
  value,
  onChange,
}: {
  value: PatientRef | null;
  onChange: (v: PatientRef | null) => void;
}) {
  const { data } = usePatientList({ per_page: 100, active_only: true });
  const patients = data?.data ?? [];

  return (
    <select
      value={value?.id ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) { onChange(null); return; }
        const p = patients.find((pt) => pt.id === id);
        if (p) onChange({ id: p.id, name: p.full_name });
      }}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">— Sin paciente —</option>
      {patients.map((p) => (
        <option key={p.id} value={p.id}>{p.full_name}</option>
      ))}
    </select>
  );
}

// ─── Authenticated Image (fetches with JWT) ───────────────────────────────────

function AuthenticatedImage({ path, className }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string;
    apiClient.get(path, { responseType: "blob" })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        setSrc(url);
      })
      .catch(() => setError(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [path]);

  if (error) return (
    <div className="flex items-center justify-center h-32 rounded-xl bg-slate-100 text-slate-400 text-sm">
      No se pudo cargar la imagen
    </div>
  );
  if (!src) return (
    <div className="flex items-center justify-center h-32 rounded-xl bg-slate-100 text-slate-400 text-sm animate-pulse">
      Cargando…
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Comprobante" className={className} />;
}

// ─── Receipt Modal ─────────────────────────────────────────────────────────────

function ReceiptModal({ tx, year, month, onClose }: {
  tx: FinanceTransaction; year: number; month: number; onClose: () => void;
}) {
  const upload = useUploadReceipt(year, month);
  const del = useDeleteReceipt(year, month);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate({ txId: tx.id, file });
  }

  function downloadReceipt() {
    if (!tx.receipt_url) return;
    apiClient.get(tx.receipt_url, { responseType: "blob" }).then((res) => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante-${tx.id.slice(0, 8)}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const isPdf = tx.receipt_url?.includes(".pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Comprobante</h3>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">{tx.description}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {tx.receipt_url ? (
            <div className="space-y-3">
              {isPdf ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <FileImage size={28} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Documento PDF</p>
                    <p className="text-xs text-slate-400">Descarga el archivo para abrirlo</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <AuthenticatedImage
                    path={tx.receipt_url}
                    className="w-full max-h-72 object-contain"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={downloadReceipt}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Download size={14} /> Descargar
                </button>
                <button
                  onClick={() => { fileRef.current!.value = ""; fileRef.current?.click(); }}
                  disabled={upload.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  <Camera size={14} /> Reemplazar
                </button>
                <button
                  onClick={() => del.mutate(tx.id, { onSuccess: onClose })}
                  disabled={del.isPending}
                  className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Camera size={32} className="text-slate-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">Subir comprobante</p>
                <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WebP o PDF — máx. 10 MB</p>
              </div>
            </div>
          )}
          {upload.isPending && (
            <p className="text-xs text-center text-blue-600 animate-pulse">Subiendo comprobante…</p>
          )}
        </div>

        <input ref={fileRef} type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Transaction Form Modal ────────────────────────────────────────────────────

interface FormState {
  category: FinanceCategory;
  description: string;
  original_amount: string;
  original_currency: "NIO" | "USD";
  patient: PatientRef | null;
  procedure_id: string;
  invoice_number: string;
  transaction_date: string;
  notes: string;
  receiptFile: File | null;
}

const today = new Date().toISOString().split("T")[0];

function emptyForm(type: FinanceType): FormState {
  return {
    category: type === "ingreso" ? "pago_tratamiento" : "laboratorio",
    description: "",
    original_amount: "",
    original_currency: "NIO",
    patient: null,
    procedure_id: "",
    invoice_number: "",
    transaction_date: today,
    notes: "",
    receiptFile: null,
  };
}

function formFromTx(tx: FinanceTransaction): FormState {
  return {
    category: tx.category,
    description: tx.description,
    original_amount: String(tx.original_amount ?? tx.amount_cordobas),
    original_currency: (tx.original_currency as "NIO" | "USD") ?? "NIO",
    patient: tx.patient ? { id: tx.patient.id, name: tx.patient.full_name } : null,
    procedure_id: tx.procedure?.id ?? "",
    invoice_number: tx.invoice_number ?? "",
    transaction_date: tx.transaction_date,
    notes: tx.notes ?? "",
    receiptFile: null,
  };
}

function TransactionModal({ type, year, month, exchangeRate, editTx, onClose }: {
  type: FinanceType; year: number; month: number; exchangeRate: number;
  editTx?: FinanceTransaction; onClose: () => void;
}) {
  const isEdit = !!editTx;
  const [form, setForm] = useState<FormState>(isEdit ? formFromTx(editTx!) : emptyForm(type));
  const create = useCreateTransaction(year, month);
  const update = useUpdateTransaction(year, month);
  const uploadReceipt = useUploadReceipt(year, month);
  const { data: procedures = [] } = useProcedures();
  const isIngreso = type === "ingreso";
  const categories = isIngreso ? INCOME_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS;
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const amountNIO =
    form.original_currency === "USD" && form.original_amount
      ? parseFloat(form.original_amount || "0") * exchangeRate
      : parseFloat(form.original_amount || "0");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.original_amount || !form.description.trim()) {
      toast.error("Completa los campos obligatorios.");
      return;
    }

    if (isEdit) {
      const payload: Record<string, unknown> = {
        category: form.category,
        description: form.description.trim(),
        original_amount: parseFloat(form.original_amount),
        original_currency: form.original_currency,
        transaction_date: form.transaction_date,
        patient_id: form.patient?.id ?? null,
        procedure_id: form.procedure_id || null,
        invoice_number: form.invoice_number.trim() || null,
        notes: form.notes.trim() || null,
      };
      update.mutate({ txId: editTx!.id, payload }, { onSuccess: onClose });
      return;
    }

    const payload: TransactionCreatePayload = {
      type,
      category: form.category,
      description: form.description.trim(),
      original_amount: parseFloat(form.original_amount),
      original_currency: form.original_currency,
      transaction_date: form.transaction_date,
    };

    if (form.patient?.id) payload.patient_id = form.patient.id;
    if (form.procedure_id) payload.procedure_id = form.procedure_id;
    if (form.invoice_number.trim()) payload.invoice_number = form.invoice_number.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();

    create.mutate(payload, {
      onSuccess: async (tx: FinanceTransaction) => {
        if (form.receiptFile) {
          try {
            await new Promise<void>((resolve, reject) => {
              uploadReceipt.mutate(
                { txId: tx.id, file: form.receiptFile! },
                { onSuccess: () => resolve(), onError: reject }
              );
            });
          } catch {
            toast.error("La transacción fue guardada pero el comprobante no se pudo subir.");
          }
        }
        onClose();
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className={`flex items-center justify-between rounded-t-2xl px-6 py-4 sticky top-0 z-10 ${isIngreso ? "bg-green-600" : "bg-red-600"}`}>
          <h2 className="text-base font-semibold text-white">
            {isEdit
              ? isIngreso ? "Editar Ingreso" : "Editar Egreso"
              : isIngreso ? "Registrar Ingreso" : "Registrar Egreso"}
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría *</label>
              <select value={form.category}
                onChange={(e) => set("category", e.target.value as FinanceCategory)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(categories).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha *</label>
              <input type="date" value={form.transaction_date}
                onChange={(e) => set("transaction_date", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
            <input type="text" value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ej: Pago de tratamiento de ortodoncia"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto *</label>
              <input type="number" step="0.01" min="0" value={form.original_amount}
                onChange={(e) => set("original_amount", e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
              <select value={form.original_currency}
                onChange={(e) => set("original_currency", e.target.value as "NIO" | "USD")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="NIO">Córdobas (C$)</option>
                <option value="USD">Dólares ($)</option>
              </select>
            </div>
          </div>

          {form.original_currency === "USD" && form.original_amount && (
            <p className="text-xs text-slate-500 -mt-2">
              ≈ C$ {fmt(amountNIO)} (tasa: C${fmt(exchangeRate)}/USD)
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paciente</label>
            <PatientSelect
              value={form.patient}
              onChange={(v) => set("patient", v)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Procedimiento</label>
            <select value={form.procedure_id}
              onChange={(e) => set("procedure_id", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Sin procedimiento —</option>
              {procedures.map((p, i) => (
                <option key={p.id} value={p.id}>{i + 1}. {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N.° de factura</label>
            <input type="text" value={form.invoice_number}
              onChange={(e) => set("invoice_number", e.target.value)}
              placeholder="Ej: FAC-001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas adicionales…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Receipt upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Foto de factura (opcional)</label>
            {form.receiptFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <FileImage size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600 flex-1 truncate">{form.receiptFile.name}</span>
                <button type="button" onClick={() => set("receiptFile", null)}
                  className="text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                <Camera size={15} />
                <span>Adjuntar foto de factura…</span>
              </button>
            )}
            <input ref={fileRef} type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) set("receiptFile", f);
              }} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={create.isPending || update.isPending || uploadReceipt.isPending}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                isIngreso ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              }`}>
              {(create.isPending || update.isPending) ? "Guardando…" : uploadReceipt.isPending ? "Subiendo foto…" : isEdit ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ───────────────────────────────────────────────────────

function DeleteModal({ tx, year, month, onClose }: {
  tx: FinanceTransaction; year: number; month: number; onClose: () => void;
}) {
  const del = useDeleteTransaction(year, month);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-semibold text-slate-800 mb-2">Eliminar transacción</h3>
        <p className="text-sm text-slate-500 mb-4">
          ¿Eliminar <strong>{tx.description}</strong> (C$ {fmt(tx.amount_cordobas)})?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={() => del.mutate(tx.id, { onSuccess: onClose })} disabled={del.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {del.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exchange Rate Editor ──────────────────────────────────────────────────────

function ExchangeRateEditor({ rate }: { rate: number }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(rate));
  const update = useUpdateExchangeRate();

  const save = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) { toast.error("Tasa inválida"); return; }
    update.mutate(n, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-slate-500">C$</span>
        <input type="number" step="0.01" value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-20 rounded border border-slate-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus />
        <button onClick={save} className="text-xs text-blue-600 hover:underline">OK</button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">✕</button>
      </span>
    );
  }
  return (
    <button onClick={() => { setVal(String(rate)); setEditing(true); }}
      className="text-xs text-slate-500 hover:text-blue-600 underline">
      Tasa USD: C${fmt(rate)} — Editar
    </button>
  );
}

// ─── Transactions Table ────────────────────────────────────────────────────────

function TransactionsTab({ year, month }: { year: number; month: number }) {
  const [tab, setTab] = useState<"all" | "ingreso" | "egreso">("all");
  const { data: txs = [], isLoading } = useTransactions(year, month, tab === "all" ? undefined : tab);
  const { data: exchangeRate = 37 } = useExchangeRate();
  const [toDelete, setToDelete] = useState<FinanceTransaction | null>(null);
  const [receiptTx, setReceiptTx] = useState<FinanceTransaction | null>(null);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const bulkDelete = useBulkDeleteTransactions(year, month);

  const allSelected = txs.length > 0 && txs.every((tx) => selectedIds.has(tx.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(txs.map((tx) => tx.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    bulkDelete.mutate([...selectedIds], {
      onSuccess: () => {
        setSelectedIds(new Set());
        setConfirmBulk(false);
      },
    });
  }

  // Clear selection when tab changes
  const prevTab = useRef(tab);
  if (prevTab.current !== tab) {
    prevTab.current = tab;
    setSelectedIds(new Set());
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 pr-3">
          <div className="flex">
            {(["all", "ingreso", "egreso"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"
                }`}>
                {t === "all" ? "Todos" : t === "ingreso" ? "Ingresos" : "Egresos"}
              </button>
            ))}
          </div>

          {someSelected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
              <button
                onClick={() => setConfirmBulk(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Trash2 size={12} /> Eliminar seleccionadas
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400 hover:text-slate-600"
                title="Cancelar selección"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando transacciones…</div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin transacciones este mes</p>
            <p className="text-sm mt-1">Usa los botones de arriba para registrar ingresos o egresos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="pl-4 pr-2 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-left">Paciente</th>
                  <th className="px-4 py-3 text-left">Procedimiento</th>
                  <th className="px-4 py-3 text-left">Factura</th>
                  <th className="px-4 py-3 text-right">Monto C$</th>
                  <th className="px-4 py-3 text-right">Costo Op.</th>
                  <th className="px-4 py-3 text-center">Foto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {txs.map((tx, i) => {
                  const isSelected = selectedIds.has(tx.id);
                  return (
                    <tr key={tx.id} className={`transition-colors ${isSelected ? "bg-blue-50" : i % 2 !== 0 ? "bg-slate-50/40 hover:bg-slate-50" : "hover:bg-slate-50"}`}>
                      <td className="pl-4 pr-2 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(tx.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">
                        {new Date(tx.transaction_date + "T12:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tx.type === "ingreso" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {tx.type === "ingreso" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {tx.type === "ingreso" ? "Ingreso" : "Egreso"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{ALL_CATEGORY_LABELS[tx.category] ?? tx.category}</td>
                      <td className="px-4 py-3 text-slate-800 text-xs max-w-[160px] truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-xs">
                        {tx.patient ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                            <User size={10} />
                            {tx.patient.full_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.procedure?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.invoice_number ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                        tx.type === "ingreso" ? "text-green-700" : "text-red-600"
                      }`}>
                        C${fmt(tx.amount_cordobas)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-amber-700">
                        {tx.operational_cost_snapshot ? `C$${fmt(tx.operational_cost_snapshot)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setReceiptTx(tx)}
                          title={tx.receipt_url ? "Ver comprobante" : "Subir comprobante"}
                          className={`rounded-lg p-1.5 transition-colors ${
                            tx.receipt_url
                              ? "text-green-600 bg-green-50 hover:bg-green-100"
                              : "text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                          }`}
                        >
                          <Camera size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditTx(tx)}
                            className="text-slate-300 hover:text-blue-500 transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setToDelete(tx)}
                            className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk delete confirmation */}
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-800 mb-2">Eliminar {selectedIds.size} transacción{selectedIds.size !== 1 ? "es" : ""}</h3>
            <p className="text-sm text-slate-500 mb-4">
              Esta acción no se puede deshacer. ¿Confirmas que deseas eliminar las {selectedIds.size} transacciones seleccionadas?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulk(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDelete.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {bulkDelete.isPending ? "Eliminando…" : "Eliminar todas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <DeleteModal tx={toDelete} year={year} month={month} onClose={() => setToDelete(null)} />
      )}
      {receiptTx && (
        <ReceiptModal tx={receiptTx} year={year} month={month} onClose={() => setReceiptTx(null)} />
      )}
      {editTx && (
        <TransactionModal
          type={editTx.type}
          year={year}
          month={month}
          exchangeRate={exchangeRate}
          editTx={editTx}
          onClose={() => setEditTx(null)}
        />
      )}
    </>
  );
}

// ─── Patient Transactions Modal ────────────────────────────────────────────────

function PatientTransactionsModal({ patientId, patientName, onClose }: {
  patientId: string; patientName: string; onClose: () => void;
}) {
  const { data: txs = [], isLoading } = usePatientTransactions(patientId);

  const totalIngresos = txs.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount_cordobas, 0);
  const totalEgresos = txs.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount_cordobas, 0);
  const countIngresos = txs.filter(t => t.type === "ingreso").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{patientName}</h3>
              <p className="text-xs text-slate-400">Historial de transacciones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Total ingresos</p>
            <p className="text-base font-bold text-green-700">C$ {fmt(totalIngresos)}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Pagos realizados</p>
            <p className="text-base font-bold text-slate-700">{countIngresos}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Total egresos</p>
            <p className="text-base font-bold text-red-600">C$ {fmt(totalEgresos)}</p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Cargando…</div>
          ) : txs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-sm">Sin transacciones registradas para este paciente.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-2.5 text-left">Fecha</th>
                  <th className="px-5 py-2.5 text-left">Categoría</th>
                  <th className="px-5 py-2.5 text-left">Descripción</th>
                  <th className="px-5 py-2.5 text-left">Procedimiento</th>
                  <th className="px-5 py-2.5 text-right">Monto C$</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(tx.transaction_date + "T12:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {ALL_CATEGORY_LABELS[tx.category] ?? tx.category}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-800 max-w-[200px] truncate">
                      {tx.description}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {tx.procedure?.name ?? "—"}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono text-sm font-semibold ${
                      tx.type === "ingreso" ? "text-green-700" : "text-red-600"
                    }`}>
                      {tx.type === "egreso" ? "-" : ""}C${fmt(tx.amount_cordobas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── By Patient Tab ────────────────────────────────────────────────────────────

function ByPatientTab({ year, month }: { year: number; month: number }) {
  const [scope, setScope] = useState<"month" | "year" | "all">("month");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const { data = [], isLoading } = useIncomeByPatient(
    scope === "all" ? undefined : year,
    scope === "month" ? month : undefined,
  );

  const max = data[0]?.total ?? 1;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Ingresos por paciente</h3>
          <div className="flex gap-1">
            {(["month", "year", "all"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  scope === s ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}>
                {s === "month" ? "Este mes" : s === "year" ? `Año ${year}` : "Todo"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando…</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Sin ingresos vinculados a pacientes</p>
            <p className="text-xs mt-1">
              {scope === "month" ? "en este mes" : scope === "year" ? `en el año ${year}` : "aún"}
            </p>
            <p className="text-xs text-slate-300 mt-3">
              Al registrar un ingreso, selecciona un paciente para verlo aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.map((row, i) => (
              <button
                key={row.patient_id}
                onClick={() => setSelected({ id: row.patient_id, name: row.patient_name })}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 transition-colors text-left"
              >
                <span className={`w-6 text-center text-sm font-bold shrink-0 ${
                  i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-800 truncate">{row.patient_name}</span>
                    <span className="text-sm font-bold text-green-700 ml-4 shrink-0">C$ {fmt(row.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400 transition-all"
                      style={{ width: `${(row.total / max) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0 w-16 text-right">
                  {row.count} {row.count === 1 ? "pago" : "pagos"}
                </span>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <PatientTransactionsModal
          patientId={selected.id}
          patientName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mainTab, setMainTab] = useState<"transactions" | "patients">("transactions");
  const [modal, setModal] = useState<"ingreso" | "egreso" | null>(null);
  const { data: summary, isLoading: loadingSummary } = useFinanceSummary(year, month);
  const { data: exchangeRate = 37 } = useExchangeRate();

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }, [month]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
          <ExchangeRateEditor rate={exchangeRate} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <button onClick={prevMonth} className="text-slate-400 hover:text-slate-700"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-700 w-36 text-center">
              {MONTHS_ES[month]} {year}
            </span>
            <button onClick={nextMonth} className="text-slate-400 hover:text-slate-700"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setModal("ingreso")}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Plus size={16} /> Ingreso
          </button>
          <button onClick={() => setModal("egreso")}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            <Plus size={16} /> Egreso
          </button>
          <button
            onClick={() => {
              window.open(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/finances/export/excel?year=${year}&month=${month}`, "_blank");
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard label="Ingresos Brutos" value={summary.ingresos_brutos}
            color="bg-green-50 border-green-200" sub={`${summary.count_ingresos} transacciones`} />
          <SummaryCard label="Egresos" value={summary.egresos}
            color="bg-red-50 border-red-200" sub={`${summary.count_egresos} transacciones`} />
          <SummaryCard label="Costos Operativos" value={summary.costos_operativos}
            color="bg-amber-50 border-amber-200" sub="De procedimientos" />
          <SummaryCard label="Ingreso Neto" value={summary.ingreso_neto}
            color={summary.ingreso_neto >= 0 ? "bg-blue-50 border-blue-200" : "bg-rose-50 border-rose-200"}
            sub="Bruto − egresos" />
          <SummaryCard label="Ingreso Neto (c/ Op.)" value={summary.ingreso_neto_con_op}
            color={summary.ingreso_neto_con_op >= 0 ? "bg-indigo-50 border-indigo-200" : "bg-rose-50 border-rose-200"}
            sub="− egresos − costos op." />
        </div>
      ) : null}

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setMainTab("transactions")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "transactions" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}>
          Transacciones
        </button>
        <button onClick={() => setMainTab("patients")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "patients" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}>
          Por paciente
        </button>
      </div>

      {mainTab === "transactions" ? (
        <TransactionsTab year={year} month={month} />
      ) : (
        <ByPatientTab year={year} month={month} />
      )}

      {modal && (
        <TransactionModal
          type={modal}
          year={year}
          month={month}
          exchangeRate={exchangeRate}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
