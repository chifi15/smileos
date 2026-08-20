"use client";

import { use, useState, useEffect } from "react";
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
  Link2,
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
import { categoryLabel, categoryColor } from "@/types/costos";
import CostSummaryBar from "@/components/costos/CostSummaryBar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── Alt Group Helpers ────────────────────────────────────────────────────────

const ALT_GROUP_COLORS: Record<string, string> = {
  A: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700",
  B: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-700",
  C: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-700",
  D: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border border-pink-200 dark:border-pink-700",
  E: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700",
};
const ALT_GROUP_LETTERS = ["A", "B", "C", "D", "E"];

function altGroupColor(g: string) {
  return ALT_GROUP_COLORS[g] ?? "bg-slate-100 text-slate-600 border border-slate-200";
}

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
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-300">
          <DollarSign size={15} className="text-slate-400 dark:text-gray-500" />
          Honorarios y configuración de precio
        </div>
        {open ? (
          <ChevronUp size={15} className="text-slate-400 dark:text-gray-500" />
        ) : (
          <ChevronDown size={15} className="text-slate-400 dark:text-gray-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-gray-700 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1.5">
                Tarifa/hora (C$)
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.professional_fee_per_hour}
                onBlur={(e) =>
                  onUpdate({ professional_fee_per_hour: parseFloat(e.target.value) || 192 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1.5">
                Total de horas
              </label>
              <input
                type="number"
                step="0.5"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.total_hours}
                onBlur={(e) =>
                  onUpdate({ total_hours: parseFloat(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1.5">
                Margen clínica (%)
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={treatment.clinic_margin_pct * 100}
                onBlur={(e) =>
                  onUpdate({ clinic_margin_pct: (parseFloat(e.target.value) || 15) / 100 })
                }
              />
            </div>
          </div>

          {globalFixedCost !== undefined && (
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 px-4 py-3 text-sm">
              <DollarSign size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
              <span className="text-blue-700 dark:text-blue-400">
                Costos fijos por paciente: <strong>C$ {globalFixedCost.toFixed(2)}</strong>
              </span>
              <a href="/costos/costos-fijos" className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Editar →
              </a>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1.5">
              Precio sugerido al paciente (C$) — dejar vacío para usar el calculado
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Agregar material</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
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
          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-gray-600 divide-y divide-slate-100 dark:divide-gray-700">
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-gray-500">Sin resultados</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${selected === p.id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-gray-300"}`}
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">{fmtC(p.unit_price)} / {p.portion_description}</p>
                </div>
                {selected === p.id && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300 whitespace-nowrap">
                Cantidad (porciones):
              </label>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="w-24 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 dark:border-gray-700 px-6 py-4">
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

  const uniqueCats = [...new Set(available.map((p) => p.category))];
  const byCategory = uniqueCats.map((cat) => ({
    cat,
    label: categoryLabel(cat),
    items: available.filter((p) => p.category === cat),
  }));

  function handleAddCategory(cat: string) {
    const toAdd = available.filter((p) => p.category === cat);
    onUpdateApt({ materials: [...apt.materials, ...toAdd.map((p) => ({ productId: p.id, quantity: 1 }))] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Agregar por categoría</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Selecciona una categoría para agregar todos sus productos</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4">
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">Todos los productos ya están en esta cita</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {byCategory.map(({ cat, label, items }) => (
                <button
                  key={cat}
                  onClick={() => handleAddCategory(cat)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 dark:border-gray-600 px-4 py-3 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(cat)}`}>
                    {label}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {items.length} producto{items.length !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-gray-700 px-6 py-4">
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
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Fusionar cita</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Los materiales de la cita seleccionada se absorberán en{" "}
              <span className="font-medium text-slate-700 dark:text-gray-300">Cita {target?.number}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {others.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">No hay otras citas para fusionar</p>
          )}
          {others.map((apt) => (
            <button
              key={apt.id}
              onClick={() => setSelectedId(apt.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedId === apt.id ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600" : "border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300">
                  {apt.number}
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-gray-300 text-sm">{apt.name}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">
                    {apt.materials.length} materiales · {fmtC(materialCost(apt))}
                  </p>
                </div>
              </div>
              {selectedId === apt.id && <Check size={15} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>

        {selectedId && (
          <div className="border-t border-slate-100 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 px-6 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              La cita seleccionada desaparecerá y sus materiales se sumarán a la Cita {target?.number}. Esta acción no se puede deshacer.
            </p>
          </div>
        )}

        <div className="flex gap-3 border-t border-slate-100 dark:border-gray-700 px-6 py-4">
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
  altGroup,
  countsInCost,
  availableGroups,
  editQty,
  editQtyValue,
  onEditQtyStart,
  onEditQtyChange,
  onEditQtySave,
  onEditQtyCancel,
  onRemove,
  onSetAltGroup,
  isSelected,
  onToggleSelect,
}: {
  productId: string;
  rowIndex: number;
  product: { id: string; name: string; unitPrice: number; category: string };
  quantity: number;
  total: number;
  altGroup: string | null;
  countsInCost: boolean;
  availableGroups: string[];
  editQty: string | null;
  editQtyValue: string;
  onEditQtyStart: () => void;
  onEditQtyChange: (v: string) => void;
  onEditQtySave: () => void;
  onEditQtyCancel: () => void;
  onRemove: () => void;
  onSetAltGroup: (g: string | null) => void;
  isSelected: boolean;
  onToggleSelect: (shiftKey: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: productId });
  const [groupOpen, setGroupOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const nextNewGroup = ALT_GROUP_LETTERS.find((l) => !availableGroups.includes(l)) ?? "A";

  return (
    <tr ref={setNodeRef} style={style} className={`group hover:bg-slate-50/50 dark:hover:bg-gray-700/30 ${!countsInCost ? "opacity-60" : ""} ${isSelected ? "bg-blue-50/60 dark:bg-blue-900/20" : ""}`}>
      <td className="pl-3 w-8 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
          className="rounded border-slate-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
        />
      </td>
      <td className="pr-1 py-2.5 w-5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400 touch-none"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="pl-2 pr-1 py-2.5 w-6 text-center text-xs font-medium text-slate-400 dark:text-gray-500 tabular-nums select-none">
        {rowIndex}
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`font-medium text-sm ${countsInCost ? "text-slate-700 dark:text-gray-300" : "text-slate-400 dark:text-gray-500 line-through"}`}>
            {product.name}
          </p>
          {altGroup && (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${altGroupColor(altGroup)}`}>
              Alt {altGroup}
              {!countsInCost && <span className="ml-1 opacity-60">(no cuenta)</span>}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor(product.category)}`}>
          {categoryLabel(product.category)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-400">
        {fmtC(product.unitPrice)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editQty === productId ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              className="w-16 rounded border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editQtyValue}
              onChange={(e) => onEditQtyChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditQtySave();
                if (e.key === "Escape") onEditQtyCancel();
              }}
            />
            <button onClick={onEditQtySave} className="rounded p-0.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
              <Check size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={onEditQtyStart}
            className="flex items-center justify-end gap-1 tabular-nums text-slate-700 dark:text-gray-300 hover:text-blue-600"
          >
            {quantity}
            <Edit2 size={10} className="text-slate-300 dark:text-gray-600 group-hover:text-slate-400 dark:group-hover:text-gray-400" />
          </button>
        )}
      </td>
      <td className={`px-5 py-2.5 text-right font-medium ${countsInCost ? "text-slate-800 dark:text-gray-200" : "text-slate-400 dark:text-gray-500 line-through"}`}>
        {fmtC(total)}
      </td>
      <td className="pr-3 text-center">
        <div className="hidden group-hover:flex items-center justify-end gap-0.5">
          {/* Botón de grupo alternativo */}
          <div className="relative">
            <button
              title="Marcar como alternativa"
              onClick={() => setGroupOpen((v) => !v)}
              className={`rounded p-1 transition-colors ${altGroup ? altGroupColor(altGroup) : "text-slate-300 hover:bg-orange-50 hover:text-orange-500"}`}
            >
              <Link2 size={12} />
            </button>
            {groupOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[150px] rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide border-b border-slate-100 dark:border-gray-700">
                  Grupo alternativo
                </p>
                {/* Grupos ya existentes */}
                {availableGroups.map((g) => (
                  <button key={g}
                    onClick={() => { onSetAltGroup(g); setGroupOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-gray-700 ${altGroup === g ? "font-semibold" : ""}`}
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${altGroupColor(g)}`}>Alt {g}</span>
                    {altGroup === g && <Check size={11} className="text-green-500 ml-auto" />}
                  </button>
                ))}
                {/* Nuevo grupo */}
                {!availableGroups.includes(nextNewGroup) || altGroup !== nextNewGroup ? (
                  <button
                    onClick={() => { onSetAltGroup(nextNewGroup); setGroupOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 border-t border-slate-100 dark:border-gray-700"
                  >
                    <Link2 size={11} />
                    Nuevo grupo {nextNewGroup}
                  </button>
                ) : null}
                {/* Quitar del grupo */}
                {altGroup && (
                  <button
                    onClick={() => { onSetAltGroup(null); setGroupOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-slate-100 dark:border-gray-700"
                  >
                    <X size={11} />
                    Quitar del grupo
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={onRemove} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
            <Trash2 size={12} />
          </button>
        </div>
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
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  useEffect(() => { if (!open) { setSelectedMaterials(new Set()); setLastSelectedIndex(null); } }, [open]);

  function toggleSelect(productId: string, index: number, shiftKey: boolean) {
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = apt.materials.slice(start, end + 1).map((m) => m.productId);
      setSelectedMaterials((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      setSelectedMaterials((prev) => {
        const next = new Set(prev);
        next.has(productId) ? next.delete(productId) : next.add(productId);
        return next;
      });
    }
    setLastSelectedIndex(index);
  }

  function selectAll() {
    setSelectedMaterials(new Set(apt.materials.map((m) => m.productId)));
    setLastSelectedIndex(null);
  }

  function clearSelection() {
    setSelectedMaterials(new Set());
    setLastSelectedIndex(null);
  }

  function deleteSelected() {
    onUpdateApt({ materials: apt.materials.filter((m) => !selectedMaterials.has(m.productId)) });
    setSelectedMaterials(new Set());
  }

  function copySelected() {
    const mats = apt.materials.filter((m) => selectedMaterials.has(m.productId));
    onCopy(mats, `${appointment.name} (${selectedMaterials.size} mat.)`, appointment.id);
    setSelectedMaterials(new Set());
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { appointment, materialCost, materials } = detail;

  function removeMaterial(productId: string) {
    onUpdateApt({ materials: apt.materials.filter((m) => m.productId !== productId) });
  }

  function setAltGroup(productId: string, group: string | null) {
    onUpdateApt({
      materials: apt.materials.map((m) =>
        m.productId === productId ? { ...m, altGroup: group } : m
      ),
    });
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

  // Groups currently used in this appointment
  const usedGroupsInHeader = [...new Set(apt.materials.filter(m => m.altGroup).map(m => m.altGroup as string))];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = apt.materials.findIndex((m) => m.productId === String(active.id));
    const newIndex = apt.materials.findIndex((m) => m.productId === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onUpdateApt({ materials: arrayMove(apt.materials, oldIndex, newIndex) });
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
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
                  className="rounded border border-blue-400 dark:border-blue-500 dark:bg-gray-700 px-2 py-0.5 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
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
                <p className="font-semibold text-slate-800 dark:text-white text-sm">{appointment.name}</p>
                <Edit2 size={10} className="text-slate-300 dark:text-gray-600 group-hover/name:text-slate-400 dark:group-hover/name:text-gray-400 shrink-0" />
              </button>
            )}
            <p className="text-xs text-slate-500 dark:text-gray-400">{materials.length} materiales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Costo cita
              {usedGroupsInHeader.length > 0 && (
                <span className="ml-1 text-orange-500 dark:text-orange-400" title="Tiene materiales alternativos: solo se suma el más caro de cada grupo">
                  (alt)
                </span>
              )}
            </p>
            <p className="font-semibold text-slate-800 dark:text-gray-200">{fmtC(materialCost)}</p>
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
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${pasteOpen ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "text-slate-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400"}`}
              >
                <ClipboardPaste size={14} />
                Pegar
              </button>
              {pasteOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 flex flex-col rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg overflow-hidden min-w-[160px]">
                  <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide border-b border-slate-100 dark:border-gray-700">
                    Desde: {clipboard.name}
                  </p>
                  <button
                    onClick={() => { onPaste(appointment.id, "replace"); setPasteOpen(false); }}
                    className="px-3 py-2.5 text-left text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                  >
                    Reemplazar todo
                  </button>
                  <button
                    onClick={() => { onPaste(appointment.id, "merge"); setPasteOpen(false); }}
                    className="px-3 py-2.5 text-left text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
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
        <div className="border-t border-slate-100 dark:border-gray-700">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Package size={24} className="text-slate-300 dark:text-gray-600" />
              <p className="text-sm text-slate-500 dark:text-gray-400">Sin materiales en esta cita</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                    <th className="pl-3 w-8 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.size === apt.materials.length && apt.materials.length > 0}
                        onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                        className="rounded border-slate-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        title="Seleccionar todo"
                      />
                    </th>
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
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                    {(() => {
                      const usedGroups = [...new Set(materials.filter(m => m.altGroup).map(m => m.altGroup as string))];
                      return materials.map(({ product, quantity, total, altGroup, countsInCost }, idx) => (
                        <SortableMaterialRow
                          key={product.id}
                          productId={product.id}
                          rowIndex={idx + 1}
                          product={product}
                          quantity={quantity}
                          total={total}
                          altGroup={altGroup}
                          countsInCost={countsInCost}
                          availableGroups={usedGroups}
                          editQty={editQty}
                          editQtyValue={editQtyValue}
                          onEditQtyStart={() => { setEditQty(product.id); setEditQtyValue(String(quantity)); }}
                          onEditQtyChange={setEditQtyValue}
                          onEditQtySave={() => saveQty(product.id)}
                          onEditQtyCancel={() => setEditQty(null)}
                          onRemove={() => removeMaterial(product.id)}
                          onSetAltGroup={(g) => setAltGroup(product.id, g)}
                          isSelected={selectedMaterials.has(product.id)}
                          onToggleSelect={(shiftKey) => toggleSelect(product.id, idx, shiftKey)}
                        />
                      ));
                    })()}
                  </tbody>
                </SortableContext>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50">
                    <td />
                    <td />
                    <td colSpan={3} className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-gray-400">
                      Subtotal cita {appointment.number}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-gray-200">
                      {fmtC(materialCost)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </DndContext>
          )}

          {selectedMaterials.size > 0 && (
            <div className="border-t border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 px-5 py-2.5 flex items-center gap-4">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {selectedMaterials.size} seleccionado{selectedMaterials.size !== 1 ? "s" : ""}
              </span>
              <button
                onClick={copySelected}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Copy size={12} /> Copiar seleccionados
              </button>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600"
              >
                <Trash2 size={12} /> Eliminar seleccionados
              </button>
              <button
                onClick={clearSelection}
                className="ml-auto text-xs text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-gray-700 px-5 py-3 flex items-center gap-4">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Plus size={13} /> Agregar material
            </button>
            <button
              onClick={() => setAddCategoryOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
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
        <div className="text-slate-400 dark:text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-gray-400 font-medium">Tratamiento no encontrado</p>
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
          className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
        >
          <ArrowLeft size={15} /> Costos
        </button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                className="text-xl font-bold text-slate-800 dark:text-white border-b-2 border-blue-500 bg-transparent dark:bg-transparent focus:outline-none w-full"
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
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
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
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{treatment.name}</h1>
              <Edit2 size={14} className="text-slate-300 dark:text-gray-600 group-hover:text-slate-500 dark:group-hover:text-gray-400" />
            </button>
          )}
          {treatment.description && (
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">{treatment.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 dark:text-gray-500">
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
          <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Materiales por cita</h2>
          <div className="flex items-center gap-2">
            {clipboard && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                <ClipboardPaste size={11} /> Copiado: {clipboard.name}
                <button onClick={() => setClipboard(null)} className="ml-1 text-green-500 hover:text-green-700 dark:hover:text-green-300">
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
