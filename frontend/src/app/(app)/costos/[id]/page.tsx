"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  Clock,
  DollarSign,
  Package,
  AlertCircle,
  Merge,
  Copy,
  ClipboardPaste,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MaterialUsage } from "@/types/costos";
import {
  useCostTreatments,
  useCostProducts,
  useFixedCosts,
  useUpdateCostTreatment,
  useAddCostAppointment,
  useDeleteCostAppointment,
  useDuplicateCostAppointment,
  useMergeCostAppointments,
  useUpdateCostAppointment,
  ApiProduct,
  ApiTreatment,
  ApiAppointment,
  ApiMaterial,
} from "@/hooks/useCostos";
import {
  calculateTreatmentCosts,
  fmtC,
  apiProductToProduct,
  apiTreatmentToTreatment,
} from "@/lib/costos-utils";
import { PRODUCT_CATEGORY_LABELS, categoryLabel, categoryColor } from "@/types/costos";
import CostSummaryBar from "@/components/costos/CostSummaryBar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── Edit Treatment Settings Panel ────────────────────────────────────────────

function TreatmentSettings({
  treatment,
  globalFixedCost,
  onUpdate,
}: {
  treatment: ApiTreatment;
  globalFixedCost?: number;
  onUpdate: (data: Partial<Omit<ApiTreatment, "id" | "appointments">>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <DollarSign size={15} className="text-slate-400" />
          Honorarios y configuración de precio
        </div>
        {open ? (
          <ChevronUp size={15} className="text-slate-400" />
        ) : (
          <ChevronDown size={15} className="text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Tarifa/hora (C$)
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.professional_fee_per_hour}
                onBlur={(e) =>
                  onUpdate({ professional_fee_per_hour: parseFloat(e.target.value) || 192 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Total de horas
              </label>
              <input
                type="number"
                step="0.5"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.total_hours}
                onBlur={(e) =>
                  onUpdate({ total_hours: parseFloat(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Margen clínica (%)
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.clinic_margin_pct * 100}
                onBlur={(e) =>
                  onUpdate({ clinic_margin_pct: (parseFloat(e.target.value) || 15) / 100 })
                }
              />
            </div>
          </div>

          {globalFixedCost !== undefined && (
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
              <DollarSign size={14} className="text-blue-500 shrink-0" />
              <span className="text-blue-700">
                Costos fijos por paciente: <strong>C$ {globalFixedCost.toFixed(2)}</strong>
              </span>
              <a href="/costos/costos-fijos" className="ml-auto text-xs text-blue-600 hover:underline font-medium">
                Editar →
              </a>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Precio sugerido al paciente (C$) — dejar vacío para usar el calculado
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.suggested_price ?? ""}
              placeholder="(usar precio calculado automáticamente)"
              onBlur={(e) =>
                onUpdate({ suggested_price: e.target.value ? parseFloat(e.target.value) : undefined })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Material Modal ───────────────────────────────────────────────────────

function AddMaterialModal({
  products,
  apt,
  onUpdateApt,
  onClose,
}: {
  products: ApiProduct[];
  apt: ApiAppointment;
  onUpdateApt: (data: { materials: ApiMaterial[] }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState("1");

  const existingIds = new Set(apt.materials.map((m) => m.productId));
  const filtered = products
    .filter((p) => !existingIds.has(p.id))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  function handleAdd() {
    if (!selected) return;
    onUpdateApt({ materials: [...apt.materials, { productId: selected, quantity: parseFloat(qty) || 1 }] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Agregar material</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors ${selected === p.id ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-400">{fmtC(p.unit_price)} / {p.portion_description}</p>
                </div>
                {selected === p.id && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Cantidad (porciones):
              </label>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleAdd} disabled={!selected}>
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add By Category Modal ────────────────────────────────────────────────────

function AddByCategoryModal({
  products,
  apt,
  onUpdateApt,
  onClose,
}: {
  products: ApiProduct[];
  apt: ApiAppointment;
  onUpdateApt: (data: { materials: ApiMaterial[] }) => void;
  onClose: () => void;
}) {
  const existingIds = new Set(apt.materials.map((m) => m.productId));
  const available = products.filter((p) => !existingIds.has(p.id));

  const byCategory = Object.entries(PRODUCT_CATEGORY_LABELS)
    .map(([cat, label]) => ({
      cat: cat as keyof typeof PRODUCT_CATEGORY_LABELS,
      label,
      items: available.filter((p) => p.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  function handleAddCategory(cat: string) {
    const toAdd = available.filter((p) => p.category === cat);
    onUpdateApt({ materials: [...apt.materials, ...toAdd.map((p) => ({ productId: p.id, quantity: 1 }))] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Agregar por categoría</h2>
            <p className="text-xs text-slate-500 mt-0.5">Selecciona una categoría para agregar todos sus productos</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4">
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Todos los productos ya están en esta cita</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {byCategory.map(({ cat, label, items }) => (
                <button
                  key={cat}
                  onClick={() => handleAddCategory(cat)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(cat)}`}>
                    {label}
                  </span>
                  <p className="text-xs text-slate-500">
                    {items.length} producto{items.length !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Appointment Modal ──────────────────────────────────────────────────

function MergeAppointmentModal({
  targetAppointmentId,
  appointments,
  products,
  onMerge,
  onClose,
}: {
  targetAppointmentId: string;
  appointments: ApiAppointment[];
  products: ApiProduct[];
  onMerge: (sourceId: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const target = appointments.find((a) => a.id === targetAppointmentId);
  const others = appointments.filter((a) => a.id !== targetAppointmentId);

  function handleMerge() {
    if (!selectedId) return;
    onMerge(selectedId);
    onClose();
  }

  function materialCost(apt: ApiAppointment) {
    return apt.materials.reduce((sum, m) => {
      const p = products.find((p) => p.id === m.productId);
      return sum + (p ? p.unit_price * m.quantity : 0);
    }, 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Fusionar cita</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los materiales de la cita seleccionada se absorberán en{" "}
              <span className="font-medium text-slate-700">Cita {target?.number}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {others.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No hay otras citas para fusionar</p>
          )}
          {others.map((apt) => (
            <button
              key={apt.id}
              onClick={() => setSelectedId(apt.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedId === apt.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">
                  {apt.number}
                </div>
                <div>
                  <p className="font-medium text-slate-700 text-sm">{apt.name}</p>
                  <p className="text-xs text-slate-400">
                    {apt.materials.length} materiales · {fmtC(materialCost(apt))}
                  </p>
                </div>
              </div>
              {selectedId === apt.id && <Check size={15} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>

        {selectedId && (
          <div className="border-t border-slate-100 bg-amber-50 px-6 py-3">
            <p className="text-xs text-amber-700">
              La cita seleccionada desaparecerá y sus materiales se sumarán a la Cita {target?.number}. Esta acción no se puede deshacer.
            </p>
          </div>
        )}

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleMerge} disabled={!selectedId}>
            Fusionar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Material Row ────────────────────────────────────────────────────

function SortableMaterialRow({
  productId,
  rowIndex,
  product,
  quantity,
  total,
  editQty,
  editQtyValue,
  onEditQtyStart,
  onEditQtyChange,
  onEditQtySave,
  onEditQtyCancel,
  onRemove,
}: {
  productId: string;
  rowIndex: number;
  product: { id: string; name: string; unitPrice: number; category: string };
  quantity: number;
  total: number;
  editQty: string | null;
  editQtyValue: string;
  onEditQtyStart: () => void;
  onEditQtyChange: (v: string) => void;
  onEditQtySave: () => void;
  onEditQtyCancel: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: productId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="group hover:bg-slate-50/50">
      <td className="pl-3 pr-1 py-2.5 w-5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="pl-2 pr-1 py-2.5 w-6 text-center text-xs font-medium text-slate-400 tabular-nums select-none">
        {rowIndex}
      </td>
      <td className="px-5 py-2.5">
        <p className="font-medium text-slate-700 text-sm">{product.name}</p>
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor(product.category)}`}>
          {categoryLabel(product.category)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-slate-600">
        {fmtC(product.unitPrice)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editQty === productId ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              className="w-16 rounded border border-blue-400 px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editQtyValue}
              onChange={(e) => onEditQtyChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditQtySave();
                if (e.key === "Escape") onEditQtyCancel();
              }}
            />
            <button
              onClick={onEditQtySave}
              className="rounded p-0.5 text-green-600 hover:bg-green-50"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={onEditQtyStart}
            className="flex items-center justify-end gap-1 tabular-nums text-slate-700 hover:text-blue-600"
          >
            {quantity}
            <Edit2 size={10} className="text-slate-300 group-hover:text-slate-400" />
          </button>
        )}
      </td>
      <td className="px-5 py-2.5 text-right font-medium text-slate-800">
        {fmtC(total)}
      </td>
      <td className="pr-3 text-center">
        <button
          onClick={onRemove}
          className="hidden rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ─── Editable Appointment ─────────────────────────────────────────────────────

function EditableAppointment({
  treatmentId,
  detail,
  apt,
  allApts,
  products,
  defaultOpen,
  clipboard,
  onCopy,
  onPaste,
  onDelete,
  onDuplicate,
  onUpdateApt,
  onMerge,
}: {
  treatmentId: string;
  detail: ReturnType<typeof calculateTreatmentCosts>["appointmentCosts"][number];
  apt: ApiAppointment;
  allApts: ApiAppointment[];
  products: ApiProduct[];
  defaultOpen?: boolean;
  clipboard: { materials: MaterialUsage[]; name: string; sourceAptId: string } | null;
  onCopy: (materials: MaterialUsage[], name: string, sourceAptId: string) => void;
  onPaste: (aptId: string, mode: "replace" | "merge") => void;
  onDelete: (aptId: string) => void;
  onDuplicate: (aptId: string) => void;
  onUpdateApt: (data: { name?: string; materials?: ApiMaterial[] }) => void;
  onMerge: (sourceId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editName, setEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editQty, setEditQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { appointment, materialCost, materials } = detail;

  function removeMaterial(productId: string) {
    onUpdateApt({ materials: apt.materials.filter((m) => m.productId !== productId) });
  }

  function saveName() {
    const trimmed = editNameValue.trim();
    if (trimmed) onUpdateApt({ name: trimmed });
    setEditName(false);
  }

  function saveQty(productId: string) {
    const newQty = parseFloat(editQtyValue);
    if (isNaN(newQty) || newQty <= 0) { setEditQty(null); return; }
    onUpdateApt({
      materials: apt.materials.map((m) =>
        m.productId === productId ? { ...m, quantity: newQty } : m
      ),
    });
    setEditQty(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = apt.materials.findIndex((m) => m.productId === String(active.id));
    const newIndex = apt.materials.findIndex((m) => m.productId === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onUpdateApt({ materials: arrayMove(apt.materials, oldIndex, newIndex) });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            {appointment.number}
          </div>
          <div>
            {editName ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  className="rounded border border-blue-400 px-2 py-0.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditName(false);
                  }}
                  onBlur={saveName}
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 group/name text-left"
                onClick={(e) => { e.stopPropagation(); setEditNameValue(appointment.name); setEditName(true); }}
              >
                <p className="font-semibold text-slate-800 text-sm">{appointment.name}</p>
                <Edit2 size={10} className="text-slate-300 group-hover/name:text-slate-400 shrink-0" />
              </button>
            )}
            <p className="text-xs text-slate-500">{materials.length} materiales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-slate-500">Costo cita</p>
            <p className="font-semibold text-slate-800">{fmtC(materialCost)}</p>
          </div>

          {/* Duplicar cita */}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(appointment.id); }}
            title="Duplicar esta cita"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-500 transition-colors"
          >
            <Copy size={14} />
          </button>

          {/* Copiar materiales al portapapeles */}
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(appointment.materials, appointment.name, appointment.id); }}
            title="Copiar materiales para pegar en otra cita"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
          >
            <ClipboardPaste size={14} />
          </button>

          {/* Pegar */}
          {clipboard && clipboard.sourceAptId !== appointment.id && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPasteOpen((v) => !v)}
                title={`Pegar materiales de "${clipboard.name}"`}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${pasteOpen ? "bg-green-100 text-green-700" : "text-slate-400 hover:bg-green-50 hover:text-green-600"}`}
              >
                <ClipboardPaste size={14} />
                Pegar
              </button>
              {pasteOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 flex flex-col rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden min-w-[160px]">
                  <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    Desde: {clipboard.name}
                  </p>
                  <button
                    onClick={() => { onPaste(appointment.id, "replace"); setPasteOpen(false); }}
                    className="px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Reemplazar todo
                  </button>
                  <button
                    onClick={() => { onPaste(appointment.id, "merge"); setPasteOpen(false); }}
                    className="px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Añadir al existente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Merge */}
          {allApts.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setMergeOpen(true); }}
              title="Fusionar con otra cita"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
            >
              <Merge size={15} />
            </button>
          )}

          {/* Eliminar cita */}
          {allApts.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${appointment.name}"?`)) onDelete(appointment.id); }}
              title="Eliminar cita"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}

          {open ? (
            <ChevronUp size={16} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Package size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">Sin materiales en esta cita</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500">
                    <th className="w-5 py-2.5" />
                    <th className="w-6 py-2.5 text-center font-medium">#</th>
                    <th className="px-5 py-2.5 text-left font-medium">Material</th>
                    <th className="px-4 py-2.5 text-right font-medium">P. unitario</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total</th>
                    <th className="w-10 py-2.5" />
                  </tr>
                </thead>
                <SortableContext
                  items={apt.materials.map((m) => m.productId)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-slate-50">
                    {materials.map(({ product, quantity, total }, idx) => (
                      <SortableMaterialRow
                        key={product.id}
                        productId={product.id}
                        rowIndex={idx + 1}
                        product={product}
                        quantity={quantity}
                        total={total}
                        editQty={editQty}
                        editQtyValue={editQtyValue}
                        onEditQtyStart={() => { setEditQty(product.id); setEditQtyValue(String(quantity)); }}
                        onEditQtyChange={setEditQtyValue}
                        onEditQtySave={() => saveQty(product.id)}
                        onEditQtyCancel={() => setEditQty(null)}
                        onRemove={() => removeMaterial(product.id)}
                      />
                    ))}
                  </tbody>
                </SortableContext>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td />
                    <td />
                    <td colSpan={3} className="px-5 py-3 text-sm font-medium text-slate-600">
                      Subtotal cita {appointment.number}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {fmtC(materialCost)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </DndContext>
          )}

          <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-4">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> Agregar material
            </button>
            <button
              onClick={() => setAddCategoryOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <Plus size={13} /> Agregar por categoría
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <AddMaterialModal
          products={products}
          apt={apt}
          onUpdateApt={onUpdateApt}
          onClose={() => setAddOpen(false)}
        />
      )}
      {addCategoryOpen && (
        <AddByCategoryModal
          products={products}
          apt={apt}
          onUpdateApt={onUpdateApt}
          onClose={() => setAddCategoryOpen(false)}
        />
      )}
      {mergeOpen && (
        <MergeAppointmentModal
          targetAppointmentId={appointment.id}
          appointments={allApts}
          products={products}
          onMerge={onMerge}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreatmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: treatments = [], isLoading: loadingTreatments } = useCostTreatments();
  const { data: apiProducts = [], isLoading: loadingProducts } = useCostProducts();
  const { data: fixedCostsConfig } = useFixedCosts();

  const updateTreatment = useUpdateCostTreatment();
  const addAppointment = useAddCostAppointment();
  const deleteAppointment = useDeleteCostAppointment();
  const duplicateAppointment = useDuplicateCostAppointment();
  const mergeMutation = useMergeCostAppointments();
  const updateApt = useUpdateCostAppointment();

  const treatment = treatments.find((t) => t.id === id);
  const products = apiProducts.map(apiProductToProduct);

  const totalFijo = fixedCostsConfig?.items?.reduce((s, i) => s + i.amount, 0) ?? 0;
  const globalFixedCost =
    (fixedCostsConfig?.patients_per_month ?? 0) > 0
      ? totalFijo / fixedCostsConfig!.patients_per_month
      : undefined;

  const [editName, setEditName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [clipboard, setClipboard] = useState<{ materials: MaterialUsage[]; name: string; sourceAptId: string } | null>(null);

  function handlePaste(aptId: string, mode: "replace" | "merge") {
    if (!clipboard || !treatment) return;
    const apt = treatment.appointments.find((a) => a.id === aptId);
    if (!apt) return;
    let newMaterials: ApiMaterial[];
    if (mode === "replace") {
      newMaterials = [...clipboard.materials];
    } else {
      const existingIds = new Set(apt.materials.map((m) => m.productId));
      newMaterials = [...apt.materials, ...clipboard.materials.filter((m) => !existingIds.has(m.productId))];
    }
    updateApt.mutate({ treatmentId: id, aptId, materials: newMaterials });
  }

  if (loadingTreatments || loadingProducts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Tratamiento no encontrado</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push("/costos")}>
            <ArrowLeft size={14} /> Volver
          </Button>
        </div>
      </div>
    );
  }

  const treatmentForCalc = apiTreatmentToTreatment(treatment);
  const breakdown = calculateTreatmentCosts(treatmentForCalc, products, globalFixedCost);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-5">
      {/* Back + Title */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/costos")}
          className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> Costos
        </button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                className="text-xl font-bold text-slate-800 border-b-2 border-blue-500 bg-transparent focus:outline-none w-full"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateTreatment.mutate({ id, name: nameValue });
                    setEditName(false);
                  }
                  if (e.key === "Escape") setEditName(false);
                }}
              />
              <button
                onClick={() => { updateTreatment.mutate({ id, name: nameValue }); setEditName(false); }}
                className="text-green-600 hover:text-green-700"
              >
                <Check size={16} />
              </button>
              <button onClick={() => setEditName(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 group text-left"
              onClick={() => { setNameValue(treatment.name); setEditName(true); }}
            >
              <h1 className="text-xl font-bold text-slate-800">{treatment.name}</h1>
              <Edit2 size={14} className="text-slate-300 group-hover:text-slate-500" />
            </button>
          )}
          {treatment.description && (
            <p className="text-sm text-slate-500 mt-0.5">{treatment.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={11} /> {treatment.total_hours}h profesional
            </span>
            <span>·</span>
            <span>
              {treatment.appointments.length} cita{treatment.appointments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Cost Summary */}
      <CostSummaryBar breakdown={breakdown} />

      {/* Settings */}
      <TreatmentSettings
        treatment={treatment}
        globalFixedCost={globalFixedCost}
        onUpdate={(data) => updateTreatment.mutate({ id, ...data })}
      />

      {/* Appointments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Materiales por cita</h2>
          <div className="flex items-center gap-2">
            {clipboard && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <ClipboardPaste size={11} /> Copiado: {clipboard.name}
                <button onClick={() => setClipboard(null)} className="ml-1 text-green-500 hover:text-green-700">
                  <X size={11} />
                </button>
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={() => addAppointment.mutate(id)}>
              <Plus size={14} /> Agregar cita
            </Button>
          </div>
        </div>
        {breakdown.appointmentCosts.map((detail, i) => {
          const apt = treatment.appointments.find((a) => a.id === detail.appointment.id)!;
          return (
            <EditableAppointment
              key={detail.appointment.id}
              treatmentId={id}
              detail={detail}
              apt={apt}
              allApts={treatment.appointments}
              products={apiProducts}
              defaultOpen={i === 0}
              clipboard={clipboard}
              onCopy={(mats, name, sourceAptId) => setClipboard({ materials: mats, name, sourceAptId })}
              onPaste={handlePaste}
              onDelete={(aptId) => deleteAppointment.mutate({ treatmentId: id, aptId })}
              onDuplicate={(aptId) => duplicateAppointment.mutate({ treatmentId: id, aptId })}
              onUpdateApt={(data) => updateApt.mutate({ treatmentId: id, aptId: apt.id, ...data })}
              onMerge={(sourceId) => mergeMutation.mutate({ treatmentId: id, targetId: apt.id, sourceId })}
            />
          );
        })}
      </div>
    </div>
  );
}
