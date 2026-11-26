"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Plus, Trash2, Play, CheckCircle2, XCircle, ScanLine, RotateCcw, Wallet, X, Pencil, FileDown, GripVertical, ArrowUpDown } from "lucide-react";
import { usePlan, useDeleteItem, useStartItem, useCancelItem, useUpdatePlan, useReopenItem, usePlanPayments, useCreatePayment, useDeletePayment, useUpdateItem, useUpdatePayment, useReorderItems } from "@/hooks/useTreatments";
import { usePatient } from "@/hooks/usePatients";
import { useClinicSettings } from "@/hooks/useSettings";
import { useDoctors } from "@/hooks/useFinances";
import toast from "react-hot-toast";
import AddItemModal from "@/components/treatments/AddItemModal";
import CompleteItemModal from "@/components/treatments/CompleteItemModal";
import ImportFromOdontogramModal from "@/components/treatments/ImportFromOdontogramModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import EditPlanModal from "@/components/treatments/EditPlanModal";
import PdfPhotosPicker, { photoLabel, OVERVIEW_ORDER } from "@/components/treatments/PdfPhotosPicker";
import { usePatientPhotos } from "@/hooks/usePhotos";
import { GROUPS, groupForTooth } from "@/lib/plan-groups";
import { buildPdfPhotos, normalizeEdit, type PhotoEdit, type PdfPhotoSelection } from "@/lib/pdf-photos";
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

function PaymentFormModal({
  patientId,
  planId,
  editing,
  onClose,
}: {
  patientId: string;
  planId: string;
  editing?: { id: string; amount: number; payment_date: string; notes: string | null };
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [date, setDate] = useState(editing?.payment_date ?? todayISO);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const create = useCreatePayment(patientId, planId, onClose);
  const update = useUpdatePayment(patientId, planId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    if (editing) {
      update.mutate(
        { paymentId: editing.id, amount: n, payment_date: date, notes: notes.trim() || null },
        { onSuccess: onClose }
      );
    } else {
      create.mutate({ amount: n, payment_date: date, notes: notes.trim() || undefined });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open onClose={onClose} title={editing ? "Editar abono" : "Registrar abono"} size="sm">
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
          <Button type="submit" loading={isPending}>
            {editing ? "Guardar cambios" : "Guardar abono"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Fila arrastrable: se toma de cualquier parte de la fila (los botones siguen funcionando). */
function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-start gap-4 px-5 py-4 bg-white dark:bg-gray-800 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-lg ring-2 ring-blue-300 rounded-lg",
      )}
    >
      <GripVertical size={16} className="mt-0.5 shrink-0 text-slate-300 dark:text-gray-600" />
      {children}
    </div>
  );
}

function EditPriceModal({
  patientId,
  planId,
  itemId,
  procedureName,
  originalName,
  currentPrice,
  onClose,
}: {
  patientId: string;
  planId: string;
  itemId: string;
  procedureName: string | null;
  originalName: string | null;
  currentPrice: number | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(procedureName ?? "");
  const [discount, setDiscount] = useState("");
  const [finalPrice, setFinalPrice] = useState(
    currentPrice != null ? String(currentPrice) : ""
  );
  const update = useUpdateItem(patientId, planId);

  function handleDiscountChange(val: string) {
    setDiscount(val);
    const pct = parseFloat(val);
    if (!isNaN(pct) && pct >= 0 && pct <= 100 && currentPrice != null) {
      setFinalPrice(String(Math.round(currentPrice * (1 - pct / 100) * 100) / 100));
    }
  }

  function handleFinalPriceChange(val: string) {
    setFinalPrice(val);
    const p = parseFloat(val);
    if (!isNaN(p) && currentPrice != null && currentPrice > 0) {
      setDiscount(String(Math.round((1 - p / currentPrice) * 10000) / 100));
    } else {
      setDiscount("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseFloat(finalPrice);
    if (isNaN(p) || p < 0) return;
    update.mutate({ itemId, quoted_price: p, custom_name: name.trim() }, { onSuccess: onClose });
  }

  const discountNum = parseFloat(discount);
  const isValidDiscount = !isNaN(discountNum) && discountNum > 0 && discountNum <= 100;

  return (
    <Modal open onClose={onClose} title="Editar tratamiento" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Nombre del tratamiento
          </label>
          <input
            type="text"
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={originalName ?? "Nombre"}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
            Solo cambia cómo se muestra en el plan y el PDF (p. ej. «Prótesis fija»); no afecta costos.
            {originalName && name.trim() !== originalName && (
              <>
                {" "}
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setName(originalName)}>
                  Restaurar «{originalName}»
                </button>
              </>
            )}
          </p>
          {currentPrice != null && (
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
              Precio original: <span className="font-semibold">C$ {fmt(currentPrice)}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Descuento (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={discount}
            onChange={(e) => handleDiscountChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isValidDiscount && currentPrice != null && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Ahorro: C$ {fmt(currentPrice * discountNum / 100)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
            Precio final (C$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={finalPrice}
            onChange={(e) => handleFinalPriceChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={update.isPending}>
            Guardar cambios
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

interface EditPriceTarget {
  itemId: string;
  procedureName: string | null;
  originalName: string | null;
  currentPrice: number | null;
}

export default function TreatmentPlanDetailPage() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>();
  const { data: patient } = usePatient(patientId);
  const { data: plan, isLoading } = usePlan(patientId, planId);
  const { data: payments = [] } = usePlanPayments(patientId, planId);
  const { data: clinic } = useClinicSettings();
  const { data: doctors = [] } = useDoctors();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfDoctorId, setPdfDoctorId] = useState("");
  const [pdfShowPrices, setPdfShowPrices] = useState(true);
  const [pdfShowChart, setPdfShowChart] = useState(true);
  const [pdfItemOrder, setPdfItemOrder] = useState<"plan" | "fdi">("fdi");
  const [pdfPhotos, setPdfPhotos] = useState<PdfPhotoSelection>({ overview: [], groups: {} });
  const { data: patientPhotos = [] } = usePatientPhotos(patientId);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{ id: string; amount: number; payment_date: string; notes: string | null } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);
  const [editPriceTarget, setEditPriceTarget] = useState<EditPriceTarget | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [chosenOption, setChosenOption] = useState<number | null>(null);

  const deleteItem = useDeleteItem(patientId, planId);
  const startItem = useStartItem(patientId, planId);
  const cancelItem = useCancelItem(patientId, planId);
  const reopenItem = useReopenItem(patientId, planId);
  const updatePlan = useUpdatePlan(patientId, planId);
  const reorderItems = useReorderItems(patientId, planId);

  // Hooks siempre antes de cualquier return temprano
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
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

  // Orden elegido por el doctor (estable: empates por fecha de creación)
  const orderedItems = [...plan.items].sort(
    (a, b) => a.sort_order - b.sort_order || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  const fdiKey = (t: string | null) => {
    const ts = (t ?? "").replace(/([1-8])\.([1-8])/g, "$1$2").match(/[1-8][1-8]/g) ?? [];
    // Cuadrante 1, 2, 3, 4 y, dentro de cada uno, de la línea media hacia atrás (1 → 8)
    return ts.length ? Math.min(...ts.map((x) => +x)) : 999;
  };
  const applyOrder = (list: typeof orderedItems) => reorderItems.mutate(list.map((i) => i.id));
  const handleItemDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = orderedItems.findIndex((i) => i.id === active.id);
    const to = orderedItems.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    applyOrder(arrayMove(orderedItems, from, to));
  };
  const sortBy = (kind: "price_asc" | "price_desc" | "priority" | "fdi") => {
    const next = [...orderedItems];
    if (kind === "price_asc") next.sort((a, b) => (a.quoted_price ?? Infinity) - (b.quoted_price ?? Infinity));
    if (kind === "price_desc") next.sort((a, b) => (b.quoted_price ?? -1) - (a.quoted_price ?? -1));
    if (kind === "priority") next.sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent"));
    if (kind === "fdi") next.sort((a, b) => fdiKey(a.tooth_fdi) - fdiKey(b.tooth_fdi));
    applyOrder(next);
  };

  // Opciones alternativas («Opción 1)», «Opción 2)»…): el paciente elige UNA, así que no se suman entre sí.
  const optionNumOf = (name?: string | null) => {
    const m = /^\s*Opci[oó]n\s*(\d+)\s*[).:\-]/i.exec(name ?? "");
    return m ? Number(m[1]) : null;
  };
  const hasOptions = new Set(plan.items.map((i) => optionNumOf(i.procedure_name)).filter((x) => x !== null)).size >= 2;
  const optSums = new Map<number, number>();
  let baseSum = 0;
  for (const i of plan.items) {
    const price = i.quoted_price ?? 0;
    const on = hasOptions ? optionNumOf(i.procedure_name) : null;
    if (on !== null) optSums.set(on, (optSums.get(on) ?? 0) + price);
    else baseSum += price;
  }
  const optionKeys = [...optSums.keys()].sort((a, b) => a - b);
  const activeOption = hasOptions ? (chosenOption !== null && optSums.has(chosenOption) ? chosenOption : optionKeys[0]) : null;
  const totalPrice = hasOptions
    ? baseSum + (optSums.get(activeOption as number) ?? 0)
    : plan.items.reduce((s, i) => s + (i.quoted_price ?? 0), 0);
  const doneCount = plan.items.filter((i) => i.status === "completed").length;
  const pct = plan.items.length > 0 ? Math.round((doneCount / plan.items.length) * 100) : 0;

  const totalAbonado = payments.reduce((s, p) => s + p.amount, 0);
  const saldo = totalPrice - totalAbonado;
  const pctPago = totalPrice > 0 ? Math.min(100, Math.round((totalAbonado / totalPrice) * 100)) : 0;

  // Doctores elegibles para el PDF: los de la clínica + quien creó el plan (si no está en la lista)
  const pdfDoctorOptions = (() => {
    const list = doctors.map((d) => ({ id: d.id, name: d.full_name }));
    if (plan?.created_by && !list.some((d) => d.id === plan.created_by!.id)) {
      list.unshift({ id: plan.created_by.id, name: plan.created_by.full_name });
    }
    return list;
  })();

  // Hemiarcadas presentes en el plan (para asignarles una foto)
  const pdfPhotoGroups = (() => {
    const present = new Set((plan?.items ?? []).filter((i) => i.status !== "cancelled").map((i) => groupForTooth(i.tooth_fdi)));
    return GROUPS.filter((g) => present.has(g.key));
  })();

  function openPdfOptions() {
    if (!plan) return;
    let remembered = "";
    try { remembered = localStorage.getItem("smileos-pdf-doctor-id") ?? ""; } catch {}
    const valid = (id: string) => !!id && pdfDoctorOptions.some((d) => d.id === id);
    setPdfDoctorId(valid(remembered) ? remembered : valid(plan.created_by?.id ?? "") ? plan.created_by!.id : "");
    // Preselección automática según la categoría de cada foto (orden fijo)
    const overview = OVERVIEW_ORDER.flatMap((t) =>
      patientPhotos.filter((p) => p.photo_type === t).map((p) => ({ photoId: p.id, edit: normalizeEdit(p.pdf_edit as Partial<PhotoEdit> | null) })),
    );
    const groups: PdfPhotoSelection["groups"] = {};
    for (const g of pdfPhotoGroups) {
      const phs = patientPhotos.filter((p) => p.photo_type === `hemi_${g.key}`);
      if (phs.length > 0) groups[g.key] = phs.map((ph) => ({ photoId: ph.id, edit: normalizeEdit(ph.pdf_edit as Partial<PhotoEdit> | null) }));
    }
    setPdfPhotos({ overview, groups });
    // Si el doctor ya ordenó los procedimientos a mano, el PDF respeta ese orden por defecto
    const orders = new Set(plan.items.map((i) => i.sort_order));
    setPdfItemOrder(orders.size > 1 ? "plan" : "fdi");
    setShowPdfOptions(true);
  }

  async function handleDownloadPdf() {
    if (!plan) return;
    try { localStorage.setItem("smileos-pdf-doctor-id", pdfDoctorId); } catch {}
    setGeneratingPdf(true);
    try {
      const { downloadTreatmentPlanPdf } = await import("@/lib/treatment-plan-pdf");
      const labelOf = (id: string) => {
        const p = patientPhotos.find((x) => x.id === id);
        return p ? photoLabel(p) : "";
      };
      const hasPhotos = pdfPhotos.overview.length > 0 || Object.keys(pdfPhotos.groups).some((k) => (pdfPhotos.groups[k]?.length ?? 0) > 0);
      const photos = hasPhotos ? await buildPdfPhotos(patientId, pdfPhotos, labelOf) : undefined;
      downloadTreatmentPlanPdf({
        photos,
        showPrices: pdfShowPrices,
        showChart: pdfShowChart,
        itemOrder: pdfItemOrder,
        clinic: {
          name: clinic?.display_name ?? "Clínica",
          legalName: clinic?.legal_name,
          phone: clinic?.phone,
          email: clinic?.email,
          address: clinic?.address_line1,
        },
        patientName: patient?.full_name ?? "Paciente",
        doctorName: pdfDoctorOptions.find((d) => d.id === pdfDoctorId)?.name ?? null,
        plan: {
          title: plan.title,
          diagnosis: plan.diagnosis,
          notes: plan.notes,
          items: orderedItems.map((i) => ({
            procedure_name: i.procedure_name,
            tooth_fdi: i.tooth_fdi,
            quoted_price: i.quoted_price,
            status: i.status,
          })),
        },
      });
    } catch {
      toast.error("No se pudo generar el PDF.");
    } finally {
      setGeneratingPdf(false);
      setShowPdfOptions(false);
    }
  }

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


      <Modal open={showPdfOptions} onClose={() => setShowPdfOptions(false)} title="PDF para el paciente" size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Select
            label="Doctor(a) que firma el plan"
            value={pdfDoctorId}
            onChange={(e) => setPdfDoctorId(e.target.value)}
            options={[
              { value: "", label: "— Sin doctor —" },
              ...pdfDoctorOptions.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <p className="text-xs text-slate-400 dark:text-gray-500">
            Aparece en el PDF junto al espacio de firma. Se recuerda para la próxima vez.
          </p>
          <Select
            label="Orden de los procedimientos"
            value={pdfItemOrder}
            onChange={(e) => setPdfItemOrder(e.target.value as "plan" | "fdi")}
            options={[
              { value: "plan", label: "Mi orden (el que dejé en el plan)" },
              { value: "fdi", label: "Por pieza FDI (incisivos a molares)" },
            ]}
          />
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={pdfShowPrices}
              onChange={(e) => setPdfShowPrices(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-gray-300">Mostrar precios</span>
              <span className="block text-xs text-slate-400 dark:text-gray-500">
                Desmárcalo para enviar solo el plan, sin costos, descuentos ni totales.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={pdfShowChart}
              onChange={(e) => setPdfShowChart(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-gray-300">Mostrar diagrama de piezas (FDI)</span>
              <span className="block text-xs text-slate-400 dark:text-gray-500">
                Dibujo de las arcadas con las piezas a tratar marcadas por colores.
              </span>
            </span>
          </label>
          <PdfPhotosPicker
            patientId={patientId}
            groups={pdfPhotoGroups}
            value={pdfPhotos}
            onChange={setPdfPhotos}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowPdfOptions(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleDownloadPdf} loading={generatingPdf}>
              <FileDown size={16} />
              Descargar PDF
            </Button>
          </div>
        </div>
      </Modal>

      {editingTitle && (
        <EditPlanModal plan={plan} patientId={patientId} onClose={() => setEditingTitle(false)} />
      )}

      {/* Plan header */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{plan.title}</h1>
              {plan.status !== "completed" && (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                  title="Editar plan (nombre, diagnósticos y notas)"
                  aria-label="Editar plan"
                >
                  <Pencil size={15} />
                </button>
              )}
              <Badge
                label={PLAN_STATUS_LABELS[plan.status as TreatmentPlanStatus]}
                className={PLAN_STATUS_COLORS[plan.status as TreatmentPlanStatus]}
              />
            </div>
            {plan.diagnosis && (
              <p className="mt-1 text-sm text-slate-600 dark:text-gray-400 whitespace-pre-line">{plan.diagnosis}</p>
            )}
            {plan.notes && (
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500 italic">{plan.notes}</p>
            )}
            <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
              Creado {format(parseISO(plan.created_at), "d 'de' MMMM yyyy", { locale: es })}
              {plan.created_by && ` por ${plan.created_by.full_name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={openPdfOptions}
              title="Descargar el plan y sus costos en PDF para el paciente"
            >
              <FileDown size={16} />
              PDF para el paciente
            </Button>
            {plan.status !== "completed" && (
              <div className="w-40">
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
                Total cotizado{hasOptions ? ` (Opción ${activeOption})` : ""}: C$ {totalPrice.toLocaleString("es-NI", { minimumFractionDigits: 2 })}
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
            {orderedItems.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-xs text-slate-500 dark:text-gray-400">
                <span className="flex items-center gap-1 font-medium"><ArrowUpDown size={13} /> Ordenar por:</span>
                {([
                  ["fdi", "Pieza (FDI)"],
                  ["priority", "Prioridad"],
                  ["price_asc", "Precio ↑"],
                  ["price_desc", "Precio ↓"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={reorderItems.isPending}
                    onClick={() => sortBy(k)}
                    className="rounded-md border border-slate-200 dark:border-gray-600 px-2 py-1 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
                <span className="text-slate-400">o arrastra cada fila para moverla. Este orden sale en el PDF.</span>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
              <SortableContext items={orderedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {orderedItems
              .map((item) => {
                const status = item.status as TreatmentItemStatus;
                const canAct = plan.status === "active";
                const isWorking =
                  deleteItem.isPending || startItem.isPending || cancelItem.isPending || reopenItem.isPending;

                return (
                  <SortableItemRow key={item.id} id={item.id}>
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
                        {canAct && (
                          <button
                            title="Editar nombre y precio"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 transition-colors"
                            onClick={() => setEditPriceTarget({
                              itemId: item.id,
                              procedureName: item.procedure_name,
                              originalName: item.original_procedure_name ?? null,
                              currentPrice: item.quoted_price ?? null,
                            })}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
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
                  </SortableItemRow>
                );
              })}
              </SortableContext>
            </DndContext>
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
            {hasOptions && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-gray-400">El paciente eligió:</span>
                {optionKeys.map((k) => (
                  <button
                    key={k}
                    onClick={() => setChosenOption(k)}
                    className={cn(
                      "rounded-full border px-3 py-1 font-medium transition-colors",
                      activeOption === k
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700",
                    )}
                  >
                    Opción {k} · C$ {fmt(baseSum + (optSums.get(k) ?? 0))}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Total del plan{hasOptions ? ` (Opción ${activeOption})` : ""}</p>
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
                <div className="flex shrink-0 gap-1">
                  <button
                    title="Editar abono"
                    className="rounded-md p-1.5 text-slate-300 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20 transition-colors"
                    onClick={() => setEditingPayment({ id: p.id, amount: p.amount, payment_date: p.payment_date, notes: p.notes })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    title="Eliminar abono"
                    className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                    onClick={() => {
                      if (window.confirm("¿Eliminar este abono?")) {
                        deletePayment.mutate(p.id);
                      }
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
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
        <PaymentFormModal
          patientId={patientId}
          planId={planId}
          onClose={() => setShowAddPayment(false)}
        />
      )}
      {editingPayment && (
        <PaymentFormModal
          patientId={patientId}
          planId={planId}
          editing={editingPayment}
          onClose={() => setEditingPayment(null)}
        />
      )}
      {editPriceTarget && (
        <EditPriceModal
          patientId={patientId}
          planId={planId}
          itemId={editPriceTarget.itemId}
          procedureName={editPriceTarget.procedureName}
          originalName={editPriceTarget.originalName}
          currentPrice={editPriceTarget.currentPrice}
          onClose={() => setEditPriceTarget(null)}
        />
      )}
    </div>
  );
}
