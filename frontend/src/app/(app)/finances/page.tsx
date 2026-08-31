"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useCostTreatments, useCostProducts, useUpdateCostProductStock } from "@/hooks/useCostos";
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
  Package,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Search,
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
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useHonorarios,
  useDoctors,
  type ExpenseCategoryItem,
  type HonorariosProcedure,
  type HonorariosDoctor,
} from "@/hooks/useFinances";
import { useProcedures } from "@/hooks/useCatalog";
import { usePatientSearch } from "@/hooks/usePatients";
import {
  FinanceTransaction,
  FinanceType,
  FinanceCategory,
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  ALL_CATEGORY_LABELS,
  TransactionCreatePayload,
} from "@/types";
import { fmtDate, useEscapeKey } from "@/lib/utils";

const MONTHS_ES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Date input DD/MM/AAAA ────────────────────────────────────────────────────

function toDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function toISO(display: string): string {
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function DateInput({ value, onChange, className }: { value: string; onChange: (iso: string) => void; className?: string }) {
  const [raw, setRaw] = useState(() => toDisplay(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setRaw(toDisplay(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRaw(v);
    const iso = toISO(v);
    if (iso) onChange(iso);
  }

  return (
    <input
      type="text"
      value={raw}
      onChange={handleChange}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setRaw(toDisplay(value)); }}
      placeholder="DD/MM/AAAA"
      maxLength={10}
      className={className}
    />
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}


const ALT_FINANCE_COLORS: Record<string, { row: string; badge: string }> = {
  A: { row: "border-l-4 border-l-orange-400 bg-orange-100 dark:bg-orange-900/25", badge: "bg-orange-200 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700" },
  B: { row: "border-l-4 border-l-violet-400 bg-violet-100 dark:bg-violet-900/25", badge: "bg-violet-200 text-violet-800 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700" },
  C: { row: "border-l-4 border-l-teal-400 bg-teal-100 dark:bg-teal-900/25", badge: "bg-teal-200 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700" },
  D: { row: "border-l-4 border-l-pink-400 bg-pink-100 dark:bg-pink-900/25", badge: "bg-pink-200 text-pink-800 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700" },
  E: { row: "border-l-4 border-l-yellow-400 bg-yellow-100 dark:bg-yellow-900/25", badge: "bg-yellow-200 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700" },
};
function altFinanceColor(g: string) {
  return ALT_FINANCE_COLORS[g] ?? { row: "border-l-2 border-l-slate-300", badge: "bg-slate-100 text-slate-600 border-slate-200" };
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, sub }: {
  label: string; value: number; color: string; sub?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-medium text-slate-500 dark:text-gray-300 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800 dark:text-white">C$ {fmt(value)}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Patient Combobox ──────────────────────────────────────────────────────────

interface PatientRef { id: string; name: string }

function PatientSelect({
  value,
  onChange,
}: {
  value: PatientRef | null;
  onChange: (v: PatientRef | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: results = [], isFetching } = usePatientSearch(query);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(p: { id: string; full_name: string }) {
    onChange({ id: p.id, name: p.full_name });
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-2">
        <span className="text-sm text-slate-800 dark:text-white">{value.name}</span>
        <button type="button" onClick={clear} className="ml-2 text-slate-400 hover:text-red-500">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Buscar paciente por nombre…"
        className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg max-h-52 overflow-y-auto">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-gray-500">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-gray-500">Sin resultados</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-white">{p.full_name}</span>
                {p.phone && <span className="text-xs text-slate-400 dark:text-gray-500">{p.phone}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
  useEscapeKey(onClose);
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
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Comprobante</h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[280px]">{tx.description}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {tx.receipt_url ? (
            <div className="space-y-3">
              {isPdf ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-600 p-4 bg-slate-50 dark:bg-gray-700">
                  <FileImage size={28} className="text-slate-400 dark:text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Documento PDF</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500">Descarga el archivo para abrirlo</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700">
                  <AuthenticatedImage
                    path={tx.receipt_url}
                    className="w-full max-h-72 object-contain"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={downloadReceipt}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-gray-600 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700"
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
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-600 p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Camera size={32} className="text-slate-300 dark:text-gray-600" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Subir comprobante</p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">JPEG, PNG, WebP o PDF — máx. 10 MB</p>
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

// ─── Expense Category Manager ─────────────────────────────────────────────────

function ExpenseCategoryManager({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const { data: cats = [], isLoading } = useExpenseCategories();
  const createCat = useCreateExpenseCategory();
  const updateCat = useUpdateExpenseCategory();
  const deleteCat = useDeleteExpenseCategory();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    createCat.mutate(label, { onSuccess: () => setNewLabel("") });
  }

  function startEdit(cat: ExpenseCategoryItem) {
    setEditingId(cat.id);
    setEditingLabel(cat.label);
  }

  function saveEdit() {
    if (!editingId || !editingLabel.trim()) return;
    updateCat.mutate({ id: editingId, label: editingLabel.trim() }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4 shrink-0">
          <h2 className="font-semibold text-slate-800 dark:text-white">Categorías de egreso</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-gray-700">
          {isLoading ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400 dark:text-gray-500">Cargando...</p>
          ) : cats.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-5 py-3 group">
              {editingId === cat.id ? (
                <>
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 rounded-lg border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={saveEdit} className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"><Check size={15} /></button>
                  <button onClick={() => setEditingId(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700 dark:text-gray-300">{cat.label}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(cat)} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500" title="Editar"><Pencil size={13} /></button>
                    <button
                      onClick={() => { if (confirm(`¿Eliminar "${cat.label}"? Las transacciones existentes conservarán la clave.`)) deleteCat.mutate(cat.id); }}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500" title="Eliminar"
                    ><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 dark:border-gray-700 px-5 py-4 shrink-0">
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Nueva categoría..."
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={!newLabel.trim() || createCat.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Plus size={15} /> Agregar
            </button>
          </div>
        </div>
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
  appointment_id: string;
  quantity: string;
  sessions: string;
  doctor_id: string;
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
    appointment_id: "",
    quantity: "1",
    sessions: "1",
    doctor_id: "",
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
    appointment_id: tx.cost_appointment_id ?? "",
    quantity: String(tx.procedure_quantity ?? 1),
    sessions: "1",
    doctor_id: tx.doctor?.id ?? "",
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
  useEscapeKey(onClose);
  const isEdit = !!editTx;
  const [form, setForm] = useState<FormState>(isEdit ? formFromTx(editTx!) : emptyForm(type));
  const create = useCreateTransaction(year, month);
  const update = useUpdateTransaction(year, month);
  const uploadReceipt = useUploadReceipt(year, month);
  const { data: procedures = [] } = useProcedures();
  const { data: apiTreatments = [] } = useCostTreatments();
  const { data: apiProducts = [] } = useCostProducts();
  const updateStock = useUpdateCostProductStock();
  const isIngreso = type === "ingreso";
  const { data: expenseCats = [] } = useExpenseCategories();
  const { data: doctors = [] } = useDoctors();
  const incomeCategories = INCOME_CATEGORY_LABELS;
  const expenseCategoryMap = Object.fromEntries(expenseCats.map((c) => [c.key, c.label]));

  // Set default egreso category once dynamic list loads (if not editing)
  useEffect(() => {
    if (!isIngreso && !isEdit && expenseCats.length > 0 && form.category === "laboratorio") {
      set("category", expenseCats[0].key as FinanceCategory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseCats.length]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Materials actually used — initialized from the linked treatment template, editable by the user
  type UsedMaterial = { productId: string; qty: number; altGroup?: string | null; sharedBy?: number };
  const [usedMaterials, setUsedMaterials] = useState<UsedMaterial[] | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [addMatSearch, setAddMatSearch] = useState("");
  const [addMatOpen, setAddMatOpen] = useState(false);

  // Extra procedures for multi-procedure visits
  type ExtraProc = { procedure_id: string; appointment_id: string };
  const [extraProcedures, setExtraProcedures] = useState<ExtraProc[]>([]);

  // En modo edición, inicializar materiales cuando cargan los tratamientos
  useEffect(() => {
    if (isEdit && form.procedure_id && apiTreatments.length > 0 && usedMaterials === null) {
      // Si la transacción ya tiene un snapshot guardado, usarlo en vez del template
      if (editTx?.deducted_materials && editTx.deducted_materials.length >= 0) {
        setUsedMaterials(editTx.deducted_materials.map((m) => ({ productId: m.productId, qty: m.qty, altGroup: m.altGroup ?? null })));
        setMaterialsOpen(true);
      } else if (form.appointment_id) {
        initMaterialsFromAppointment(form.procedure_id, form.appointment_id);
      } else {
        initMaterialsFromTreatment(form.procedure_id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTreatments.length, isEdit, form.procedure_id]);

  function getMaterialsForSpec(procedureId: string, appointmentId: string): { productId: string; qty: number; altGroup: string | null }[] {
    const treatment = apiTreatments.find((t) => t.procedure_catalog_id === procedureId);
    if (!treatment) return [];
    if (appointmentId) {
      const apt = treatment.appointments.find((a) => a.id === appointmentId);
      if (!apt) return [];
      return apt.materials.map((m) => ({ productId: m.productId, qty: m.quantity, altGroup: m.altGroup ?? null }));
    }
    const totals = new Map<string, number>();
    const groups = new Map<string, string | null>();
    for (const apt of treatment.appointments) {
      for (const m of apt.materials) {
        totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.quantity);
        if (!groups.has(m.productId)) groups.set(m.productId, m.altGroup ?? null);
      }
    }
    return Array.from(totals.entries()).map(([productId, qty]) => ({ productId, qty, altGroup: groups.get(productId) ?? null }));
  }

  function mergeMaterialSpecs(specs: { procedure_id: string; appointment_id: string }[]): UsedMaterial[] {
    const maxQty = new Map<string, number>();
    const groups = new Map<string, string | null>();
    const countByProduct = new Map<string, number>(); // how many procedures use this product
    const validIds = new Set(apiProducts.map((p) => p.id));

    for (const spec of specs) {
      if (!spec.procedure_id) continue;
      const mats = getMaterialsForSpec(spec.procedure_id, spec.appointment_id);
      for (const m of mats) {
        if (!validIds.has(m.productId)) continue;
        maxQty.set(m.productId, Math.max(maxQty.get(m.productId) ?? 0, m.qty));
        if (!groups.has(m.productId)) groups.set(m.productId, m.altGroup);
        countByProduct.set(m.productId, (countByProduct.get(m.productId) ?? 0) + 1);
      }
    }

    return Array.from(maxQty.entries()).map(([productId, qty]) => ({
      productId,
      qty,
      altGroup: groups.get(productId) ?? null,
      sharedBy: countByProduct.get(productId) ?? 1,
    }));
  }

  function autoSelectAltGroups(materials: UsedMaterial[]): UsedMaterial[] {
    // Determinar el ganador de cada altGroup (el más caro; si empatan, el primero)
    const winners = new Map<string, UsedMaterial>();
    for (const m of materials) {
      if (!m.altGroup) continue;
      const existing = winners.get(m.altGroup);
      const price = apiProducts.find((p) => p.id === m.productId)?.unit_price ?? 0;
      const existingPrice = existing ? (apiProducts.find((p) => p.id === existing.productId)?.unit_price ?? 0) : -1;
      if (!existing || price > existingPrice) winners.set(m.altGroup, m);
    }
    // Recorrer en orden original: incluir no-alt siempre, y alt solo si es el ganador (una vez)
    const seenGroups = new Set<string>();
    return materials.filter((m) => {
      if (!m.altGroup) return true;
      if (seenGroups.has(m.altGroup)) return false;
      if (winners.get(m.altGroup)?.productId === m.productId) {
        seenGroups.add(m.altGroup);
        return true;
      }
      return false;
    });
  }

  function recomputeMerged(mainProcId: string, mainAptId: string, extras: ExtraProc[]) {
    const allSpecs = [{ procedure_id: mainProcId, appointment_id: mainAptId }, ...extras];
    const hasAnyProc = allSpecs.some((s) => !!s.procedure_id);
    if (!hasAnyProc) { setUsedMaterials(null); return; }
    const merged = mergeMaterialSpecs(allSpecs);
    setUsedMaterials(merged.length > 0 ? merged : []);
    setMaterialsOpen(true);
  }

  // Costo combinado correcto:
  // Base = suma de operational_cost individuales
  // Ahorro = materiales compartidos que antes se pagaban N veces, ahora 1
  // Combinado = base − ahorro  (siempre ≥ costo del procedimiento más caro)
  function calcCombinedOpCost(
    mainProcId: string,
    mainAptId: string,
    extras: ExtraProc[],
    merged: UsedMaterial[]
  ): { total: number; savings: number; individualSum: number } {
    const allSpecs = [{ procedure_id: mainProcId, appointment_id: mainAptId }, ...extras]
      .filter((s) => !!s.procedure_id);

    // Suma de costos operativos individuales (proc.operational_cost)
    const individualSum = allSpecs.reduce((sum, s) => {
      const p = procedures.find((p) => p.id === s.procedure_id);
      return sum + (p?.operational_cost ?? 0);
    }, 0);

    // Costo de materiales de cada procedimiento por separado (sin compartir)
    const individualMatCost = allSpecs.reduce((sum, s) => {
      const mats = getMaterialsForSpec(s.procedure_id, s.appointment_id);
      return sum + calcMaterialsCost(mats);
    }, 0);

    // Costo de materiales con fusión (máximo por producto compartido)
    const mergedMatCost = calcMaterialsCost(merged);

    // Ahorro = diferencia entre pagar materiales por separado vs compartidos
    const savings = Math.max(0, individualMatCost - mergedMatCost);

    // Costo combinado = suma individual − ahorro de materiales compartidos
    // Nunca puede ser menor que el costo individual más alto
    const maxIndividual = allSpecs.reduce((max, s) => {
      const p = procedures.find((p) => p.id === s.procedure_id);
      return Math.max(max, p?.operational_cost ?? 0);
    }, 0);

    const total = Math.max(individualSum - savings, maxIndividual);
    return { total, savings, individualSum };
  }

  function initMaterialsFromTreatment(procedureId: string) {
    if (!procedureId) { setUsedMaterials(null); return; }
    recomputeMerged(procedureId, "", extraProcedures);
  }

  function initMaterialsFromAppointment(procedureId: string, aptId: string) {
    recomputeMerged(procedureId, aptId, extraProcedures);
  }

  function addExtraProcedure() {
    setExtraProcedures((prev) => [...prev, { procedure_id: "", appointment_id: "" }]);
  }

  function removeExtraProcedure(idx: number) {
    const updated = extraProcedures.filter((_, i) => i !== idx);
    setExtraProcedures(updated);
    recomputeMerged(form.procedure_id, form.appointment_id, updated);
  }

  function updateExtraProc(idx: number, field: keyof ExtraProc, value: string) {
    const updated = extraProcedures.map((ep, i) => i === idx ? { ...ep, [field]: value, ...(field === "procedure_id" ? { appointment_id: "" } : {}) } : ep);
    setExtraProcedures(updated);
    recomputeMerged(form.procedure_id, form.appointment_id, updated);
  }

  function calcMaterialsCost(materials: { productId: string; qty: number }[]): number {
    return materials.reduce((sum, m) => {
      const product = apiProducts.find((p) => p.id === m.productId);
      return sum + (product ? product.unit_price * m.qty : 0);
    }, 0);
  }

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

    const qty = Math.max(1, parseInt(form.quantity) || 1);
    const sessions = Math.max(1, parseInt(form.sessions) || 1);
    const isMultiProc = extraProcedures.some((ep) => !!ep.procedure_id);

    // Resolver alternativos antes de calcular costos para que ambos sean consistentes
    const resolvedMaterials = usedMaterials ? autoSelectAltGroups(usedMaterials) : null;

    // Costo operativo a registrar:
    // - Multi-proc: suma de costos individuales menos ahorro por materiales compartidos
    // - Cita específica: materiales de esa cita + (honorarios + costos_fijos) / total de citas
    // - Single proc normal: null (el backend usa operational_cost del procedimiento)
    let opCostOverride: number | null = null;
    if (isMultiProc && resolvedMaterials) {
      opCostOverride = calcCombinedOpCost(form.procedure_id, form.appointment_id, extraProcedures, resolvedMaterials).total;
    } else if (form.appointment_id && resolvedMaterials) {
      const apptTreatment = apiTreatments.find((t) => t.procedure_catalog_id === form.procedure_id);
      const materialCost = calcMaterialsCost(resolvedMaterials);
      if (apptTreatment) {
        const profFees = (apptTreatment.professional_fee_per_hour || 0) * (apptTreatment.total_hours || 0);
        const fixedCosts = apptTreatment.fixed_costs || 0;
        const totalApts = apptTreatment.appointments.length || 1;
        opCostOverride = Math.round((materialCost + (profFees + fixedCosts) / totalApts) * 100) / 100;
      } else {
        opCostOverride = materialCost;
      }
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
        cost_appointment_id: form.appointment_id || null,
        quantity: qty,
        sessions,
        doctor_id: form.doctor_id || null,
        invoice_number: form.invoice_number.trim() || null,
        notes: form.notes.trim() || null,
        deducted_materials: resolvedMaterials ? resolvedMaterials.map((m) => ({ productId: m.productId, qty: m.qty, altGroup: m.altGroup ?? null })) : null,
      };
      if (opCostOverride !== null) payload.operational_cost_override = opCostOverride;
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
      doctor_id: form.doctor_id || null,
    };

    if (form.patient?.id) payload.patient_id = form.patient.id;
    if (form.procedure_id) {
      payload.procedure_id = form.procedure_id;
      if (form.appointment_id) payload.cost_appointment_id = form.appointment_id;
      payload.quantity = qty;
      if (sessions > 1) payload.sessions = sessions;
      if (opCostOverride !== null) payload.operational_cost_override = opCostOverride;
    }
    if (form.invoice_number.trim()) payload.invoice_number = form.invoice_number.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (resolvedMaterials !== null) {
      payload.deducted_materials = resolvedMaterials.map((m) => ({ productId: m.productId, qty: m.qty, altGroup: m.altGroup ?? null }));
    }

    create.mutate(payload, {
      onSuccess: async (tx: FinanceTransaction) => {
        // Descontar materiales del inventario usando los materiales resueltos (alternativos ya filtrados)
        const materialsToDeduct = resolvedMaterials ?? (() => {
          if (!tx.procedure?.id) return [];
          const treatment = apiTreatments.find((t) => t.procedure_catalog_id === tx.procedure!.id);
          if (!treatment) return [];
          const totals = new Map<string, number>();
          for (const apt of treatment.appointments) {
            for (const m of apt.materials) {
              totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.quantity);
            }
          }
          return Array.from(totals.entries()).map(([productId, qty]) => ({ productId, qty }));
        })();
        const procedureQty = tx.procedure_quantity ?? 1;
        for (const { productId, qty: usedPortions } of materialsToDeduct) {
          const product = apiProducts.find((p) => p.id === productId);
          if (!product) continue;
          const deductQty = product.portion_qty
            ? usedPortions * product.portion_qty * procedureQty
            : usedPortions * procedureQty;
          updateStock.mutate({ id: productId, qty: -deductQty, operation: "add" });
        }
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
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className={`flex items-center justify-between rounded-t-2xl px-6 py-4 sticky top-0 z-10 ${isIngreso ? "bg-green-600" : "bg-red-600"}`}>
          <h2 className="text-base font-semibold text-white">
            {isEdit
              ? isIngreso ? "Editar Ingreso" : "Editar Egreso"
              : isIngreso ? "Registrar Ingreso" : "Registrar Egreso"}
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isIngreso && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Paciente</label>
              <PatientSelect value={form.patient} onChange={(v) => set("patient", v)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Categoría *</label>
              <select value={form.category}
                onChange={(e) => set("category", e.target.value as FinanceCategory)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {isIngreso
                  ? Object.entries(incomeCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  : expenseCats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Fecha *</label>
              <DateInput value={form.transaction_date} onChange={(iso) => set("transaction_date", iso)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Descripción *</label>
            <input type="text" value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ej: Pago de tratamiento de ortodoncia"
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Monto *</label>
              <input type="number" step="0.01" min="0" value={form.original_amount}
                onChange={(e) => set("original_amount", e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Moneda</label>
              <select value={form.original_currency}
                onChange={(e) => set("original_currency", e.target.value as "NIO" | "USD")}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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

          {!isIngreso && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Paciente</label>
              <PatientSelect value={form.patient} onChange={(v) => set("patient", v)} />
            </div>
          )}

          {/* ── Procedimiento(s) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400">Procedimiento</label>
              {!isEdit && form.procedure_id && extraProcedures.length === 0 && (
                <button
                  type="button"
                  onClick={addExtraProcedure}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <Plus size={11} /> Agregar otro procedimiento
                </button>
              )}
            </div>

            {/* Procedimiento principal */}
            <select value={form.procedure_id}
              onChange={(e) => {
                set("procedure_id", e.target.value);
                set("appointment_id", "");
                set("quantity", "1");
                set("sessions", "1");
                recomputeMerged(e.target.value, "", extraProcedures);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Sin procedimiento —</option>
              {procedures.map((p, i) => (
                <option key={p.id} value={p.id}>{i + 1}. {p.name}</option>
              ))}
            </select>

            {/* Selector de cita para el procedimiento principal (multi-sesión) */}
            {form.procedure_id && (() => {
              const treatment = apiTreatments.find((t) => t.procedure_catalog_id === form.procedure_id);
              if (!treatment || treatment.appointments.length <= 1) return null;
              return (
                <select
                  value={form.appointment_id}
                  onChange={(e) => {
                    const aptId = e.target.value;
                    set("appointment_id", aptId);
                    recomputeMerged(form.procedure_id, aptId, extraProcedures);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Todas las citas —</option>
                  {treatment.appointments
                    .slice().sort((a, b) => a.number - b.number)
                    .map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        Cita {apt.number}{apt.name ? `: ${apt.name}` : ""} ({apt.materials.length} mat.)
                      </option>
                    ))}
                </select>
              );
            })()}

            {/* Procedimientos extra */}
            {extraProcedures.map((ep, idx) => {
              const extraTreatment = ep.procedure_id
                ? apiTreatments.find((t) => t.procedure_catalog_id === ep.procedure_id)
                : null;
              const usedIds = new Set([form.procedure_id, ...extraProcedures.filter((_, i) => i !== idx).map((e) => e.procedure_id)]);
              return (
                <div key={idx} className="space-y-1.5 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">+ Procedimiento {idx + 2}</span>
                    <button
                      type="button"
                      onClick={() => removeExtraProcedure(idx)}
                      className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <select
                    value={ep.procedure_id}
                    onChange={(e) => updateExtraProc(idx, "procedure_id", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Seleccionar —</option>
                    {procedures
                      .filter((p) => !usedIds.has(p.id))
                      .map((p, i) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {ep.procedure_id && extraTreatment && extraTreatment.appointments.length > 1 && (
                    <select
                      value={ep.appointment_id}
                      onChange={(e) => updateExtraProc(idx, "appointment_id", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Todas las citas —</option>
                      {extraTreatment.appointments
                        .slice().sort((a, b) => a.number - b.number)
                        .map((apt) => (
                          <option key={apt.id} value={apt.id}>
                            Cita {apt.number}{apt.name ? `: ${apt.name}` : ""} ({apt.materials.length} mat.)
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              );
            })}

            {/* Botón agregar más procedimientos (cuando ya hay al menos uno extra) */}
            {!isEdit && form.procedure_id && extraProcedures.length > 0 &&
              extraProcedures.every((ep) => !!ep.procedure_id) &&
              (extraProcedures.length + 1) < procedures.length && (
              <button
                type="button"
                onClick={addExtraProcedure}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-200 dark:border-blue-700 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Plus size={12} /> Agregar otro procedimiento
              </button>
            )}
          </div>

          {/* ── Cantidad / Sesiones / Costo preview ── */}
          {form.procedure_id && (() => {
            const isMultiProc = extraProcedures.some((ep) => !!ep.procedure_id);
            const proc = procedures.find((p) => p.id === form.procedure_id);
            const qty = Math.max(1, parseInt(form.quantity) || 1);
            const sess = Math.max(1, parseInt(form.sessions) || 1);
            const unitCost = proc?.operational_cost ?? 0;
            const matCost = form.appointment_id && usedMaterials ? calcMaterialsCost(usedMaterials) : null;

            let costPreview: number;
            let costLabel: React.ReactNode;
            if (isMultiProc && usedMaterials) {
              const { total, savings, individualSum } = calcCombinedOpCost(
                form.procedure_id, form.appointment_id, extraProcedures, usedMaterials
              );
              costPreview = total;
              costLabel = savings > 0 ? (
                <>
                  Costo op. combinado: <strong>C${fmt(individualSum)}</strong>
                  <span className="text-green-700 dark:text-green-400"> − C${fmt(savings)} compartidos</span>
                  {" = "}<strong>C${fmt(costPreview)}</strong>
                </>
              ) : (
                <>Costo op. combinado: <strong>C${fmt(costPreview)}</strong></>
              );
            } else if (form.appointment_id && matCost !== null) {
              costPreview = matCost;
              costLabel = <>Costo op. esta cita: <strong>C${fmt(costPreview)}</strong> <span className="opacity-70">(por materiales)</span></>;
            } else if (sess > 1) {
              costPreview = unitCost * qty / sess;
              costLabel = <>Costo op.: C${fmt(unitCost)} ÷ {sess} ses. = <strong>C${fmt(costPreview)}</strong></>;
            } else {
              costPreview = unitCost * qty;
              costLabel = <>Costo op.: C${fmt(unitCost)} × {qty} = <strong>C${fmt(costPreview)}</strong></>;
            }

            return (
              <div className="flex items-end gap-3">
                {!isMultiProc && (
                  <>
                    <div className="w-24 shrink-0">
                      <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Cantidad</label>
                      <input type="number" min="1" step="1" value={form.quantity}
                        onChange={(e) => set("quantity", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {!form.appointment_id && (
                      <div className="w-24 shrink-0">
                        <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Sesiones</label>
                        <input type="number" min="1" step="1" value={form.sessions}
                          onChange={(e) => set("sessions", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="El costo operativo se divide entre las sesiones." />
                      </div>
                    )}
                  </>
                )}
                {(unitCost > 0 || matCost !== null) && (
                  <p className="mb-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 flex-1">
                    {costLabel}
                  </p>
                )}
              </div>
            );
          })()}

          {isIngreso && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Doctor que realizó el procedimiento</label>
              <select value={form.doctor_id}
                onChange={(e) => set("doctor_id", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sin asignar —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Panel de materiales ── */}
          {usedMaterials !== null && (
            <div className="rounded-xl border border-slate-200 dark:border-gray-600 overflow-hidden">
              <button
                type="button"
                onClick={() => setMaterialsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400 dark:text-gray-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                    {isEdit
                      ? "Materiales del procedimiento"
                      : extraProcedures.some((ep) => !!ep.procedure_id)
                        ? "Materiales fusionados a descontar"
                        : "Materiales a descontar del inventario"}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-gray-400">
                    {usedMaterials.length}
                  </span>
                  {isEdit && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1.5 py-0.5">
                      Solo referencia
                    </span>
                  )}
                </div>
                {materialsOpen ? <ChevronUp size={14} className="text-slate-400 dark:text-gray-500" /> : <ChevronDown size={14} className="text-slate-400 dark:text-gray-500" />}
              </button>

              {materialsOpen && (
                <div className="border-t border-slate-100 dark:border-gray-700 divide-y divide-slate-50 dark:divide-gray-700">
                  {extraProcedures.some((ep) => !!ep.procedure_id) && usedMaterials && usedMaterials.some((m) => (m.sharedBy ?? 1) > 1) && (
                    <p className="px-4 py-2.5 text-[10px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30">
                      Los materiales marcados <strong>Compartido</strong> se usan en ambos procedimientos — se cobra una sola vez (el mayor de los dos).
                    </p>
                  )}
                  {usedMaterials.some((m) => m.altGroup) && (
                    <p className="px-4 py-2.5 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800/30">
                      Materiales con <strong>Alt</strong> son alternativos entre sí — elimina los que no usaste. Si dejas todos, se descuenta automáticamente el más caro del grupo.
                    </p>
                  )}
                  {usedMaterials.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400 dark:text-gray-500 italic">Sin materiales — no se descontará nada del inventario.</p>
                  ) : (
                    usedMaterials.map((m) => {
                      const product = apiProducts.find((p) => p.id === m.productId);
                      return (
                        <div key={m.productId} className={`flex items-center gap-3 px-4 py-2 ${m.altGroup ? altFinanceColor(m.altGroup).row : ""}`}>
                          <span className="flex-1 text-xs text-slate-700 dark:text-gray-300 truncate">
                            {product?.name ?? m.productId}
                            {product?.portion_description && (
                              <span className="text-slate-400 dark:text-gray-500 ml-1">/ {product.portion_description}</span>
                            )}
                            {m.altGroup && (
                              <span className={`ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold border ${altFinanceColor(m.altGroup).badge}`}>
                                Alt {m.altGroup}
                              </span>
                            )}
                            {(m.sharedBy ?? 1) > 1 && (
                              <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                                Compartido
                              </span>
                            )}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={m.qty}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) {
                                setUsedMaterials((prev) => prev!.map((x) => x.productId === m.productId ? { ...x, qty: v } : x));
                              }
                            }}
                            className="w-16 rounded border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 w-8">
                            {product?.presentation_unit ?? "u"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setUsedMaterials((prev) => prev!.filter((x) => x.productId !== m.productId))}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                            title="Quitar este material"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}

                  {/* Agregar material alternativo */}
                  {addMatOpen ? (
                    <div className="px-4 py-3 space-y-2 bg-slate-50 dark:bg-gray-700/50">
                      <input
                        autoFocus
                        placeholder="Buscar producto..."
                        value={addMatSearch}
                        onChange={(e) => setAddMatSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-slate-50 dark:divide-gray-700">
                        {apiProducts
                          .filter((p) => !usedMaterials.some((m) => m.productId === p.id))
                          .filter((p) => p.name.toLowerCase().includes(addMatSearch.toLowerCase()))
                          .slice(0, 12)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setUsedMaterials((prev) => [...prev!, { productId: p.id, qty: 1 }]);
                                setAddMatOpen(false);
                                setAddMatSearch("");
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Check size={12} className="text-transparent" />
                              <span className="text-xs text-slate-700 dark:text-gray-300">{p.name}</span>
                              <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500">{p.portion_description}</span>
                            </button>
                          ))}
                      </div>
                      <button type="button" onClick={() => { setAddMatOpen(false); setAddMatSearch(""); }}
                        className="text-xs text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">Cancelar</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddMatOpen(true)}
                      className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={12} /> Agregar material alternativo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">N.° de factura</label>
            <input type="text" value={form.invoice_number}
              onChange={(e) => set("invoice_number", e.target.value)}
              placeholder="Ej: FAC-001"
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Notas</label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas adicionales…"
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Receipt upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Foto de factura (opcional)</label>
            {form.receiptFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-2">
                <FileImage size={16} className="text-slate-400 dark:text-gray-500 shrink-0" />
                <span className="text-sm text-slate-600 dark:text-gray-300 flex-1 truncate">{form.receiptFile.name}</span>
                <button type="button" onClick={() => set("receiptFile", null)}
                  className="text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-gray-600 px-3 py-2.5 text-sm text-slate-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
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
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
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
  useEscapeKey(onClose);
  const del = useDeleteTransaction(year, month);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Eliminar transacción</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
          ¿Eliminar <strong>{tx.description}</strong> (C$ {fmt(tx.amount_cordobas)})?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
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
        <span className="text-xs text-slate-500 dark:text-gray-400">C$</span>
        <input type="number" step="0.01" value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-20 rounded border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus />
        <button onClick={save} className="text-xs text-blue-600 hover:underline">OK</button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">✕</button>
      </span>
    );
  }
  return (
    <button onClick={() => { setVal(String(rate)); setEditing(true); }}
      className="text-xs text-slate-500 dark:text-gray-400 hover:text-blue-600 underline">
      Tasa USD: C${fmt(rate)} — Editar
    </button>
  );
}

// ─── Transactions Table ────────────────────────────────────────────────────────

function TransactionsTab({ year, month }: { year: number; month: number }) {
  const [tab, setTab] = useState<"all" | "ingreso" | "egreso">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: txs = [], isLoading } = useTransactions(year, month, tab === "all" ? undefined : tab);
  const { data: exchangeRate = 37 } = useExchangeRate();
  const { data: expenseCats = [] } = useExpenseCategories();
  const dynamicCategoryLabels = Object.fromEntries(expenseCats.map((c) => [c.key, c.label]));
  const [toDelete, setToDelete] = useState<FinanceTransaction | null>(null);
  const [receiptTx, setReceiptTx] = useState<FinanceTransaction | null>(null);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const bulkDelete = useBulkDeleteTransactions(year, month);

  // Clear selection when tab changes
  const prevTab = useRef(tab);
  if (prevTab.current !== tab) {
    prevTab.current = tab;
    setSelectedIds(new Set());
  }

  const filteredTxs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return txs;
    return txs.filter((tx) => {
      return (
        tx.patient?.full_name?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.invoice_number?.toLowerCase().includes(q) ||
        tx.procedure?.name?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        (ALL_CATEGORY_LABELS[tx.category] ?? dynamicCategoryLabels[tx.category] ?? tx.category)?.toLowerCase().includes(q)
      );
    });
  }, [txs, searchQuery, dynamicCategoryLabels]);

  const allSelected = filteredTxs.length > 0 && filteredTxs.every((tx) => selectedIds.has(tx.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTxs.map((tx) => tx.id)));
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

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 pr-3">
          <div className="flex">
            {(["all", "ingreso", "egreso"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
                }`}>
                {t === "all" ? "Todos" : t === "ingreso" ? "Ingresos" : "Egresos"}
              </button>
            ))}
          </div>

          {someSelected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-gray-400">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
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

        {/* Search bar */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/60">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por paciente, descripción, factura…"
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              {filteredTxs.length} resultado{filteredTxs.length !== 1 ? "s" : ""} de {txs.length}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-sm">Cargando transacciones…</div>
        ) : filteredTxs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-gray-500">
            {searchQuery.trim() ? (
              <>
                <Search size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin resultados</p>
                <p className="text-sm mt-1">No hay transacciones que coincidan con &ldquo;{searchQuery}&rdquo;.</p>
              </>
            ) : (
              <>
                <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin transacciones este mes</p>
                <p className="text-sm mt-1">Usa los botones de arriba para registrar ingresos o egresos.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
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
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                {filteredTxs.map((tx, i) => {
                  const isSelected = selectedIds.has(tx.id);
                  return (
                    <tr key={tx.id} className={`transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : i % 2 !== 0 ? "bg-slate-50/40 dark:bg-gray-700/20 hover:bg-slate-50 dark:hover:bg-gray-700" : "hover:bg-slate-50 dark:hover:bg-gray-700"}`}>
                      <td className="pl-4 pr-2 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(tx.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-gray-400 text-xs">
                        {fmtDate(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tx.type === "ingreso" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        }`}>
                          {tx.type === "ingreso" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {tx.type === "ingreso" ? "Ingreso" : "Egreso"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-400 text-xs">{ALL_CATEGORY_LABELS[tx.category] ?? dynamicCategoryLabels[tx.category] ?? tx.category}</td>
                      <td className="px-4 py-3 text-slate-800 dark:text-gray-200 text-xs max-w-[160px] truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-xs">
                        {tx.patient ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                            <User size={10} />
                            {tx.patient.full_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{tx.procedure?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">{tx.invoice_number ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                        tx.type === "ingreso" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}>
                        C${fmt(tx.amount_cordobas)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-amber-700 dark:text-amber-400">
                        {tx.operational_cost_snapshot ? `C$${fmt(tx.operational_cost_snapshot)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setReceiptTx(tx)}
                          title={tx.receipt_url ? "Ver comprobante" : "Subir comprobante"}
                          className={`rounded-lg p-1.5 transition-colors ${
                            tx.receipt_url
                              ? "text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                              : "text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:text-gray-600 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
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
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Eliminar {selectedIds.size} transacción{selectedIds.size !== 1 ? "es" : ""}</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
              Esta acción no se puede deshacer. ¿Confirmas que deseas eliminar las {selectedIds.size} transacciones seleccionadas?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulk(false)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
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
  useEscapeKey(onClose);
  const { data: txs = [], isLoading } = usePatientTransactions(patientId);

  const totalIngresos = txs.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount_cordobas, 0);
  const totalEgresos = txs.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount_cordobas, 0);
  const countIngresos = txs.filter(t => t.type === "ingreso").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <User size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">{patientName}</h3>
              <p className="text-xs text-slate-400 dark:text-gray-500">Historial de transacciones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-gray-700 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Total ingresos</p>
            <p className="text-base font-bold text-green-700 dark:text-green-400">C$ {fmt(totalIngresos)}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Pagos realizados</p>
            <p className="text-base font-bold text-slate-700 dark:text-gray-300">{countIngresos}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-slate-400 dark:text-gray-500 mb-0.5">Total egresos</p>
            <p className="text-base font-bold text-red-600 dark:text-red-400">C$ {fmt(totalEgresos)}</p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-sm">Cargando…</div>
          ) : txs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-gray-500">
              <p className="text-sm">Sin transacciones registradas para este paciente.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
                <tr className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-2.5 text-left">Fecha</th>
                  <th className="px-5 py-2.5 text-left">Categoría</th>
                  <th className="px-5 py-2.5 text-left">Descripción</th>
                  <th className="px-5 py-2.5 text-left">Procedimiento</th>
                  <th className="px-5 py-2.5 text-right">Monto C$</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-gray-700">
                    <td className="px-5 py-3 text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(tx.transaction_date)}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-gray-400">
                      {ALL_CATEGORY_LABELS[tx.category] ?? tx.category}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-800 dark:text-gray-200 max-w-[200px] truncate">
                      {tx.description}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 dark:text-gray-400">
                      {tx.procedure?.name ?? "—"}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono text-sm font-semibold ${
                      tx.type === "ingreso" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Ingresos por paciente</h3>
          <div className="flex gap-1">
            {(["month", "year", "all"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  scope === s ? "bg-blue-600 text-white" : "text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
                }`}>
                {s === "month" ? "Este mes" : s === "year" ? `Año ${year}` : "Todo"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-sm">Cargando…</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-gray-500">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Sin ingresos vinculados a pacientes</p>
            <p className="text-xs mt-1">
              {scope === "month" ? "en este mes" : scope === "year" ? `en el año ${year}` : "aún"}
            </p>
            <p className="text-xs text-slate-300 dark:text-gray-600 mt-3">
              Al registrar un ingreso, selecciona un paciente para verlo aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {data.map((row, i) => (
              <button
                key={row.patient_id}
                onClick={() => setSelected({ id: row.patient_id, name: row.patient_name })}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <span className={`w-6 text-center text-sm font-bold shrink-0 ${
                  i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400 dark:text-gray-400" : i === 2 ? "text-amber-700 dark:text-amber-500" : "text-slate-300 dark:text-gray-600"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">{row.patient_name}</span>
                    <span className="text-sm font-bold text-green-700 dark:text-green-400 ml-4 shrink-0">C$ {fmt(row.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400 transition-all"
                      style={{ width: `${(row.total / max) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-slate-400 dark:text-gray-500 shrink-0 w-16 text-right">
                  {row.count} {row.count === 1 ? "pago" : "pagos"}
                </span>
                <ChevronRight size={14} className="text-slate-300 dark:text-gray-600 shrink-0" />
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

// ─── Honorarios Tab ───────────────────────────────────────────────────────────

function HonorariosTab({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useHonorarios(year, month);
  const [view, setView] = useState<"doctor" | "procedure">("doctor");

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.by_procedure.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center">
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          No hay honorarios registrados para este mes.
        </p>
        <p className="text-slate-400 dark:text-gray-500 text-xs mt-1">
          Los honorarios se calculan desde los procedimientos con costo en el módulo de Costos.
        </p>
      </div>
    );
  }

  const maxProc = data.by_procedure[0]?.total_honorarios ?? 1;
  const maxDoc = data.by_doctor[0]?.total_honorarios ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
          <button onClick={() => setView("doctor")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              view === "doctor" ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
            }`}>
            Por doctor
          </button>
          <button onClick={() => setView("procedure")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              view === "procedure" ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
            }`}>
            Por procedimiento
          </button>
        </div>
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 px-3 py-1 rounded-full">
          Total mes: C$ {fmt(data.total_honorarios)}
        </span>
      </div>

      {view === "doctor" ? (
        <div className="space-y-4">
          {data.by_doctor.map((doc: HonorariosDoctor) => (
            <div key={doc.doctor_id ?? "__sin_doctor__"} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-5 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800/40 flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-gray-200 text-sm">{doc.doctor_name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 w-32 h-2 bg-purple-100 dark:bg-purple-800/40 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                      style={{ width: `${(doc.total_honorarios / maxDoc) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap">
                    C$ {fmt(doc.total_honorarios)}
                  </span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 text-xs text-slate-500 dark:text-gray-400">
                    <th className="px-5 py-2 text-left font-medium">Procedimiento</th>
                    <th className="px-4 py-2 text-right font-medium">Honorario/u.</th>
                    <th className="px-4 py-2 text-right font-medium">Cant.</th>
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.procedures.map((p, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-2.5 text-slate-700 dark:text-gray-300">{p.procedure_name}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">C$ {fmt(p.fee_per_unit)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">{p.quantity}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-purple-700 dark:text-purple-400">C$ {fmt(p.total_honorarios)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700 text-xs text-slate-500 dark:text-gray-400">
                <th className="px-5 py-2.5 text-left font-medium">Procedimiento</th>
                <th className="px-4 py-2.5 text-right font-medium">Honorario / unidad</th>
                <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                <th className="px-5 py-2.5 text-right font-medium">Total honorarios</th>
                <th className="px-5 py-2.5 text-right font-medium w-40">Distribución</th>
              </tr>
            </thead>
            <tbody>
              {data.by_procedure.map((row: HonorariosProcedure) => (
                <tr key={row.procedure_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-gray-200">{row.procedure_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-400">C$ {fmt(row.fee_per_unit)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-400">{row.quantity}</td>
                  <td className="px-5 py-3 text-right font-semibold text-purple-700 dark:text-purple-400">C$ {fmt(row.total_honorarios)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                          style={{ width: `${(row.total_honorarios / maxProc) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-gray-500 w-8 text-right">
                        {Math.round((row.total_honorarios / data.total_honorarios) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-purple-50 dark:bg-purple-900/20">
                <td colSpan={3} className="px-5 py-3 text-sm font-bold text-slate-700 dark:text-gray-300">Total</td>
                <td className="px-5 py-3 text-right text-base font-bold text-purple-700 dark:text-purple-400">
                  C$ {fmt(data.total_honorarios)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mainTab, setMainTab] = useState<"transactions" | "patients" | "honorarios">("transactions");
  const [modal, setModal] = useState<"ingreso" | "egreso" | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const { data: summary, isLoading: loadingSummary } = useFinanceSummary(year, month);
  const { data: honorariosData } = useHonorarios(year, month);
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Finanzas</h1>
          <ExchangeRateEditor rate={exchangeRate} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2">
            <button onClick={prevMonth} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-700 dark:text-gray-300 w-36 text-center">
              {MONTHS_ES[month]} {year}
            </span>
            <button onClick={nextMonth} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setModal("ingreso")}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Plus size={16} /> Ingreso
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setModal("egreso")}
              className="flex items-center gap-2 rounded-l-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <Plus size={16} /> Egreso
            </button>
            <button onClick={() => setShowCatManager(true)} title="Gestionar categorías de egreso"
              className="flex items-center rounded-r-xl border-l border-red-700 bg-red-600 px-2 py-2 text-white hover:bg-red-700">
              <Settings2 size={15} />
            </button>
          </div>
          <button
            onClick={() => {
              window.open(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/finances/export/excel?year=${year}&month=${month}`, "_blank");
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-gray-700 animate-pulse" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard label="Ingresos Brutos" value={summary.ingresos_brutos}
            color="bg-green-50 border-green-200 dark:bg-green-900/40 dark:border-green-700" sub={`${summary.count_ingresos} transacciones`} />
          <SummaryCard label="Egresos" value={summary.egresos}
            color="bg-red-50 border-red-200 dark:bg-red-900/40 dark:border-red-700" sub={`${summary.count_egresos} transacciones`} />
          <SummaryCard label="Costos Operativos" value={summary.costos_operativos}
            color="bg-amber-50 border-amber-200 dark:bg-amber-900/40 dark:border-amber-700" sub="De procedimientos" />
          <SummaryCard label="Ingreso Neto" value={summary.ingreso_neto}
            color={summary.ingreso_neto >= 0 ? "bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-700" : "bg-rose-50 border-rose-200 dark:bg-rose-900/40 dark:border-rose-700"}
            sub="Bruto − egresos" />
          <SummaryCard label="Ingreso Neto (c/ Op.)" value={summary.ingreso_neto_con_op}
            color={summary.ingreso_neto_con_op >= 0 ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/40 dark:border-indigo-700" : "bg-rose-50 border-rose-200 dark:bg-rose-900/40 dark:border-rose-700"}
            sub="− egresos − costos op." />
          <SummaryCard label="Honorarios Dr." value={honorariosData?.total_honorarios ?? 0}
            color="bg-purple-50 border-purple-200 dark:bg-purple-900/40 dark:border-purple-700" sub="De procedimientos facturados" />
        </div>
      ) : null}

      <div className="flex gap-1 bg-slate-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
        <button onClick={() => setMainTab("transactions")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "transactions" ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
          }`}>
          Transacciones
        </button>
        <button onClick={() => setMainTab("patients")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "patients" ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
          }`}>
          Por paciente
        </button>
        <button onClick={() => setMainTab("honorarios")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            mainTab === "honorarios" ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
          }`}>
          Honorarios Dr.
        </button>
      </div>

      {mainTab === "transactions" ? (
        <TransactionsTab year={year} month={month} />
      ) : mainTab === "patients" ? (
        <ByPatientTab year={year} month={month} />
      ) : (
        <HonorariosTab year={year} month={month} />
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
      {showCatManager && <ExpenseCategoryManager onClose={() => setShowCatManager(false)} />}
    </div>
  );
}
