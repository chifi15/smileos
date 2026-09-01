"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator, Package, ChevronRight, ChevronDown,
  TrendingUp, Plus, Calendar, Trash2, X, GripVertical, Pencil, Check, Copy,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCostProducts,
  useCostTreatments,
  useFixedCosts,
  useCreateCostTreatment,
  useDeleteCostTreatment,
  useDuplicateCostTreatment,
  useReorderCostTreatments,
  useUpdateCostTreatment,
  ApiTreatment,
} from "@/hooks/useCostos";
import { calculateTreatmentCosts, fmtC, apiProductToProduct, apiTreatmentToTreatment } from "@/lib/costos-utils";
import { useEscapeKey } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── Inline editable number ───────────────────────────────────────────────────

function InlineNum({ value, onChange, suffix, step = "1", min = "0" }: {
  value: number; onChange: (v: number) => void; suffix?: string; step?: string; min?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <input
          autoFocus type="number" step={step} min={min} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onChange(parseFloat(draft) || value); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => { onChange(parseFloat(draft) || value); setEditing(false); }}
          className="w-16 rounded border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </span>
    );
  }
  return (
    <button onClick={() => { setDraft(String(value)); setEditing(true); }} className="inline-flex items-center gap-0.5 rounded px-1 hover:bg-blue-50 group/ie" title="Clic para editar">
      <span className="text-xs font-medium text-slate-700 dark:text-gray-300 tabular-nums">{value}{suffix}</span>
      <Pencil size={9} className="text-slate-300 dark:text-gray-600 group-hover/ie:text-blue-500" />
    </button>
  );
}

// ─── New Treatment Modal ──────────────────────────────────────────────────────

function NewTreatmentModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const createTreatment = useCreateCostTreatment();
  const { data: fixedCosts } = useFixedCosts();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyFee, setHourlyFee] = useState("192");
  const [hours, setHours] = useState("1");
  const [margin, setMargin] = useState("15");
  const [numCitas, setNumCitas] = useState("1");

  const totalFijo = (fixedCosts?.items ?? []).reduce((s, i) => s + i.amount, 0);
  const perPaciente = (fixedCosts?.patients_per_month ?? 1) > 0 ? totalFijo / (fixedCosts?.patients_per_month ?? 1) : 216;

  function handleCreate() {
    if (!name.trim()) return;
    const n = Math.max(1, parseInt(numCitas) || 1);
    createTreatment.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      professional_fee_per_hour: parseFloat(hourlyFee) || 192,
      total_hours: parseFloat(hours) || 1,
      fixed_costs: perPaciente,
      clinic_margin_pct: (parseFloat(margin) || 15) / 100,
      appointments: Array.from({ length: n }, (_, i) => ({
        number: i + 1,
        name: n === 1 ? "Cita única" : `Cita ${i + 1}`,
        materials: [],
      })),
    }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Nuevo tratamiento</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Input label="Nombre del tratamiento" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Blanqueamiento dental" autoFocus />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-300">Descripción (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Breve descripción..."
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número de citas" type="number" min={1} value={numCitas} onChange={(e) => setNumCitas(e.target.value)} />
            <Input label="Horas totales" type="number" step="0.5" min={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tarifa/hora (C$)" type="number" value={hourlyFee} onChange={(e) => setHourlyFee(e.target.value)} />
            <Input label="Margen (%)" type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 dark:border-gray-700 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={!name.trim() || createTreatment.isPending}>Crear tratamiento</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Card ───────────────────────────────────────────────────────────

function TreatmentCard({ treatment, globalFixedCost }: { treatment: ApiTreatment; globalFixedCost: number }) {
  const { data: apiProducts = [] } = useCostProducts();
  const deleteTreatment = useDeleteCostTreatment();
  const duplicateTreatment = useDuplicateCostTreatment();
  const updateTreatment = useUpdateCostTreatment();

  const products = apiProducts.map(apiProductToProduct);
  const t = apiTreatmentToTreatment(treatment);
  const breakdown = calculateTreatmentCosts(t, products, globalFixedCost);
  const [showDesglose, setShowDesglose] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: treatment.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  function upd(key: "professional_fee_per_hour" | "total_hours" | "clinic_margin_pct", val: number) {
    updateTreatment.mutate({ id: treatment.id, [key]: val });
  }

  const utilidad = breakdown.finalPrice - breakdown.calculatedPrice;
  const marginPct = breakdown.calculatedPrice > 0 ? (utilidad / breakdown.calculatedPrice) * 100 : 0;

  return (
    <div ref={setNodeRef} style={style} className="group relative rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md transition-shadow">
      <button {...attributes} {...listeners}
        className="absolute left-3 top-3 hidden rounded-lg p-1 text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing group-hover:flex touch-none" title="Arrastrar para ordenar">
        <GripVertical size={15} />
      </button>
      <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1">
        <button
          onClick={(e) => { e.preventDefault(); duplicateTreatment.mutate(treatment.id); }}
          title="Duplicar tratamiento"
          className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); if (confirm(`¿Eliminar "${treatment.name}"?`)) deleteTreatment.mutate(treatment.id); }}
          title="Eliminar tratamiento"
          className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Link href={`/costos/${treatment.id}`} className="block mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <Calculator size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 dark:text-white truncate pr-6">{treatment.name}</h3>
            {treatment.description && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 line-clamp-1">{treatment.description}</p>}
          </div>
        </div>
      </Link>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {treatment.appointments.map((apt) => (
          <div key={apt.id} className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-gray-300">
            <Calendar size={10} />
            Cita {apt.number}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 px-3 py-2.5">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Costo operativo</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">{fmtC(breakdown.totalMaterialsCost)}</p>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">Precio paciente</p>
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{fmtC(breakdown.finalPrice)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 px-3 py-2.5">
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Total</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">{fmtC(breakdown.calculatedPrice)}</p>
        </div>
        <div className={`rounded-lg px-3 py-2.5 ${utilidad >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
          <p className={`text-xs mb-0.5 ${utilidad >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>Utilidad estimada</p>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className={utilidad >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
            <p className={`text-sm font-semibold ${utilidad >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {fmtC(utilidad)}{" "}
              <span className="text-xs font-normal">({marginPct.toFixed(0)}%)</span>
            </p>
          </div>
        </div>
      </div>

      <button onClick={() => setShowDesglose((v) => !v)}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
        <span>Desglose de precio</span>
        <ChevronDown size={13} className={`transition-transform ${showDesglose ? "rotate-180" : ""}`} />
      </button>

      {showDesglose && (
        <div className="mt-1 rounded-lg border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 px-4 py-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-gray-400">Materiales</span>
            <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{fmtC(breakdown.totalMaterialsCost)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-gray-400 shrink-0">Honorarios</span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <InlineNum value={treatment.professional_fee_per_hour} onChange={(v) => upd("professional_fee_per_hour", v)} suffix="/h" />
              <span className="text-slate-400 dark:text-gray-500">×</span>
              <InlineNum value={treatment.total_hours} onChange={(v) => upd("total_hours", v)} step="0.5" min="0.5" suffix="h" />
              <span className="text-slate-400 dark:text-gray-500">=</span>
              <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{fmtC(breakdown.professionalFees)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-gray-400 shrink-0">Costos fijos</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{fmtC(breakdown.fixedCosts)}</span>
              <Link href="/costos/costos-fijos" className="text-[10px] text-blue-500 hover:underline">(configurar)</Link>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-gray-600 pt-1.5 mt-1">
            <span className="font-semibold text-slate-600 dark:text-gray-300">Subtotal</span>
            <span className="font-semibold text-slate-800 dark:text-gray-200 tabular-nums">{fmtC(breakdown.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-gray-400 shrink-0">+ Margen</span>
            <div className="flex items-center gap-1 justify-end">
              <InlineNum value={Math.round(treatment.clinic_margin_pct * 100)} onChange={(v) => upd("clinic_margin_pct", v / 100)} suffix="%" min="0" />
              <span className="text-slate-400 dark:text-gray-500">=</span>
              <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{fmtC(breakdown.margin)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-gray-600 pt-1.5 mt-1">
            <span className="font-semibold text-blue-700 dark:text-blue-400">Precio paciente</span>
            <span className="font-bold text-blue-700 dark:text-blue-400 tabular-nums">{fmtC(breakdown.finalPrice)}</span>
          </div>
          {treatment.suggested_price && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 pt-0.5">* Precio manual activo: C$ {treatment.suggested_price}. Edítalo en el detalle del tratamiento.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-gray-500">
        <span>{treatment.appointments.length} cita{treatment.appointments.length !== 1 ? "s" : ""}</span>
        <Link href={`/costos/${treatment.id}`} className="flex items-center gap-1 text-blue-600 font-medium hover:underline">
          Ver materiales <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostosPage() {
  const { data: treatments = [], isLoading } = useCostTreatments();
  const { data: fixedCosts } = useFixedCosts();
  const reorderTreatments = useReorderCostTreatments();
  const [showModal, setShowModal] = useState(false);

  const totalFijo = (fixedCosts?.items ?? []).reduce((s, i) => s + i.amount, 0);
  const patientsPerMonth = fixedCosts?.patients_per_month ?? 1;
  const perPaciente = patientsPerMonth > 0 ? totalFijo / patientsPerMonth : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = treatments.findIndex((t) => t.id === active.id);
    const newIndex = treatments.findIndex((t) => t.id === over.id);
    reorderTreatments.mutate(arrayMove(treatments, oldIndex, newIndex).map((t) => t.id));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 dark:text-gray-500">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Costos Operativos</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">Calcula y compara el costo por tratamiento dividido por citas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/costos/costos-fijos">
            <Button variant="secondary" size="sm"><Package size={15} /> Costos fijos</Button>
          </Link>
          <Link href="/costos/productos">
            <Button variant="secondary" size="sm"><Package size={15} /> Productos</Button>
          </Link>
          <Button size="sm" onClick={() => setShowModal(true)}><Plus size={15} /> Nuevo tratamiento</Button>
        </div>
      </div>

      {perPaciente > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-100 dark:border-blue-800/30 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm">
          <span className="text-blue-700 dark:text-blue-400">
            Costo fijo por paciente: <strong>{fmtC(perPaciente)}</strong>
            <span className="text-blue-500 dark:text-blue-500 ml-1">({fmtC(totalFijo)}/mes ÷ {patientsPerMonth} pacientes)</span>
          </span>
          <Link href="/costos/costos-fijos" className="text-blue-600 font-medium hover:underline text-xs">Editar →</Link>
        </div>
      )}

      {treatments.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-gray-700 text-center">
          <Calculator size={32} className="text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-slate-500 dark:text-gray-400 font-medium">Sin tratamientos</p>
          <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">Crea el primer tratamiento para comenzar</p>
          <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}><Plus size={15} /> Nuevo tratamiento</Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={treatments.map((t) => t.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {treatments.map((t) => <TreatmentCard key={t.id} treatment={t} globalFixedCost={perPaciente} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && <NewTreatmentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
