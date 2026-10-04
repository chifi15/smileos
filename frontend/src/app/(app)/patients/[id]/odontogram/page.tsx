"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, History, Plus, Trash2, Calculator,
  Stethoscope, ClipboardList, Copy, GripVertical, Tag,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePatient } from "@/hooks/usePatients";
import {
  useOdontogram, useUpdateOdontogram, useOdontogramSnapshots,
  useCopyInicialToTratamiento, useTreatmentQuote, useSaveTreatmentQuote,
} from "@/hooks/useOdontogram";
import { useProcedures } from "@/hooks/useCatalog";
import { useCostTreatments, useCostProducts, useFixedCosts } from "@/hooks/useCostos";
import { calculateTreatmentCosts, apiTreatmentToTreatment, apiProductToProduct } from "@/lib/costos-utils";
import {
  ToothCondition, OdontogramTooth,
  TOOTH_CONDITION_LABELS, TOOTH_CONDITION_COLORS, QuoteItem,
} from "@/types";
import OdontogramChart from "@/components/odontogram/OdontogramChart";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";

function fmtNIO(n: number) {
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 0 }).format(n);
}

function SortableQuoteRow({
  item, idx, onPriceChange, onRemove,
}: {
  item: QuoteItem;
  idx: number;
  onPriceChange: (id: string, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="grid grid-cols-12 items-center px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
    >
      <div className="col-span-1 flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-xs font-bold text-slate-400 dark:text-gray-500">{idx + 1}</span>
      </div>
      <span className="col-span-1 text-sm font-mono text-slate-500 dark:text-gray-400">
        {item.toothNumber ?? "—"}
      </span>
      <span className="col-span-5 text-sm text-slate-700 dark:text-gray-300">{item.procedureName}</span>
      <div className="col-span-4 flex justify-end">
        <input
          type="number"
          min="0"
          step="1"
          value={item.price}
          onChange={(e) => onPriceChange(item.id, e.target.value)}
          className="w-28 text-right rounded border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="col-span-1 flex justify-end">
        <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-400 transition-colors ml-2">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

interface PendingChange {
  condition: ToothCondition;
  notes: string | null;
}

// ─── Snapshot Viewer ──────────────────────────────────────────────────────────

function SnapshotViewer({ patientId, kind, onClose }: {
  patientId: string; kind: string; onClose: () => void;
}) {
  const { data: snapshots = [], isLoading } = useOdontogramSnapshots(patientId, kind);
  const [selected, setSelected] = useState<string | null>(null);
  const snap = selected ? snapshots.find((s) => s.id === selected) : null;
  const title = kind === "inicial"
    ? "Historial — Odontograma Inicial"
    : "Historial — Plan de Tratamiento";

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : snapshots.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Aún no hay registros guardados.
        </p>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          <div className="w-48 shrink-0 border-r border-slate-100 dark:border-gray-700 pr-3 overflow-y-auto max-h-[500px]">
            {snapshots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors mb-1 ${
                  selected === s.id
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                <p className="font-medium">
                  {format(parseISO(s.created_at), "dd MMM yyyy", { locale: es })}
                </p>
                <p className="text-slate-400 dark:text-gray-500">{format(parseISO(s.created_at), "HH:mm")}</p>
                {s.snapshot_notes && (
                  <p className="mt-0.5 text-slate-500 truncate">{s.snapshot_notes}</p>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {!snap ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Selecciona un registro para ver el estado
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Guardado por {snap.created_by?.full_name ?? "—"} el{" "}
                  {format(parseISO(snap.created_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                </div>
                {snap.snapshot_notes && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                    {snap.snapshot_notes}
                  </div>
                )}
                <div className="space-y-1">
                  {Object.entries(snap.teeth_data)
                    .filter(([, v]) => v.condition !== "sano")
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([num, v]) => (
                      <div key={num} className="flex items-center gap-2 text-xs">
                        <span className="w-8 font-mono text-slate-500 dark:text-gray-400">{num}</span>
                        <span className="font-medium text-slate-700 dark:text-gray-300">
                          {TOOTH_CONDITION_LABELS[v.condition]}
                        </span>
                        {v.notes && <span className="text-slate-400 dark:text-gray-500">— {v.notes}</span>}
                      </div>
                    ))}
                  {Object.values(snap.teeth_data).every((v) => v.condition === "sano") && (
                    <p className="text-xs text-slate-400 dark:text-gray-500">Todas las piezas en estado sano.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Odontogram Section (reutilizable para ambas pestañas) ────────────────────

function OdontogramSection({ patientId, kind }: { patientId: string; kind: string }) {
  const { data: teeth = [], isLoading } = useOdontogram(patientId, kind);
  const [pendingChanges, setPendingChanges] = useState<Record<number, PendingChange>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  const update = useUpdateOdontogram(
    patientId,
    kind,
    () => setPendingChanges({}),
    () => setPendingChanges({}),
  );
  const copyFromInicial = useCopyInicialToTratamiento(patientId);

  // Build previewTeeth — optimistic overlay on top of persisted DB data.
  const teethByNum = new Map(teeth.map((t) => [t.tooth_number, t]));
  const ALL_NUMS = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,
                    31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
  const previewTeeth: OdontogramTooth[] = ALL_NUMS.map((num) => {
    const base: OdontogramTooth = teethByNum.get(num) ?? {
      id: `preview-${num}`,
      tooth_number: num,
      condition: "sano",
      notes: null,
      updated_at: null,
      updated_by: null,
    };
    const pending = pendingChanges[num];
    return pending ? { ...base, condition: pending.condition, notes: pending.notes } : base;
  });

  function handleToothChange(num: number, condition: ToothCondition, notes: string | null) {
    // Optimistic update for immediate visual feedback; save persists to DB right away.
    setPendingChanges((prev) => ({ ...prev, [num]: { condition, notes } }));
    update.mutate({ teeth: { [num]: { condition, notes } }, snapshot_notes: null });
  }

  const affected = previewTeeth.filter((t) => t.condition !== "sano");

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          {kind === "tratamiento" && (
            confirmCopy ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-gray-400">¿Sobrescribir con el estado actual del Odontograma Inicial?</span>
                <button
                  onClick={() => { copyFromInicial.mutate(); setConfirmCopy(false); }}
                  disabled={copyFromInicial.isPending}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {copyFromInicial.isPending ? "Copiando…" : "Sí, copiar"}
                </button>
                <button
                  onClick={() => setConfirmCopy(false)}
                  className="rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmCopy(true)}>
                <Copy size={14} />
                Copiar desde Inicial
              </Button>
            )
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)}>
          <History size={15} />
          Historial
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-slate-100 dark:border-gray-700">
            <OdontogramChart
              teeth={previewTeeth}
              editable={!update.isPending}
              onChange={handleToothChange}
            />
          </div>

          <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-slate-100 dark:border-gray-700">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm">
              Resumen — piezas con tratamiento
            </h2>
            {affected.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-gray-500">Todas las piezas en estado sano.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {affected.map((t) => {
                  const colors = TOOTH_CONDITION_COLORS[t.condition];
                  return (
                    <div
                      key={t.tooth_number}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${colors.bg} ${colors.border}`}
                    >
                      <span className={`text-base font-bold w-5 text-center ${colors.text}`}>
                        {colors.symbol}
                      </span>
                      <div>
                        <span className={`font-mono font-bold mr-1.5 ${colors.text}`}>{t.tooth_number}</span>
                        <span className={`font-medium ${colors.text}`}>{TOOTH_CONDITION_LABELS[t.condition]}</span>
                        {t.notes && (
                          <p className="text-slate-500 dark:text-gray-400 truncate mt-0.5">{t.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showHistory && (
        <SnapshotViewer patientId={patientId} kind={kind} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OdontogramPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: procedures = [] } = useProcedures();
  const { data: apiTreatments = [] } = useCostTreatments();
  const { data: apiProducts = [] } = useCostProducts();
  const { data: fixedCosts } = useFixedCosts();
  const { data: savedQuote } = useTreatmentQuote(id);
  const saveQuote = useSaveTreatmentQuote(id);

  const totalFijo = (fixedCosts?.items ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0);
  const perPaciente = (fixedCosts?.patients_per_month ?? 1) > 0
    ? totalFijo / (fixedCosts?.patients_per_month ?? 1)
    : 0;
  const products = apiProducts.map(apiProductToProduct);

  const priceByProcedureId = new Map<string, number>();
  for (const t of apiTreatments) {
    if (!t.procedure_catalog_id) continue;
    const breakdown = calculateTreatmentCosts(apiTreatmentToTreatment(t), products, perPaciente);
    priceByProcedureId.set(t.procedure_catalog_id, breakdown.finalPrice);
  }

  const [activeTab, setActiveTab] = useState<"inicial" | "tratamiento">("inicial");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  const [addTooth, setAddTooth] = useState<string>("");
  const [addProc, setAddProc] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!quoteLoaded && savedQuote) {
    setQuoteItems(savedQuote.items);
    setDiscountPct(savedQuote.discount_pct ?? 0);
    setQuoteLoaded(true);
  }

  const subtotal = quoteItems.reduce((sum, i) => sum + i.price, 0);
  const discountAmt = subtotal * (discountPct / 100);
  const quoteTotal = subtotal - discountAmt;

  function save(items: QuoteItem[], pct: number) {
    saveQuote.mutate({ items, discount_pct: pct });
  }

  function handleAddQuoteItem() {
    const proc = procedures.find((p) => p.id === addProc);
    if (!proc) return;
    const newItems: QuoteItem[] = [...quoteItems, {
      id: Math.random().toString(36).slice(2),
      toothNumber: addTooth ? parseInt(addTooth) : null,
      procedureId: proc.id,
      procedureName: proc.name,
      price: priceByProcedureId.get(proc.id) ?? proc.default_price ?? 0,
    }];
    setQuoteItems(newItems);
    save(newItems, discountPct);
    setAddTooth("");
    setAddProc("");
  }

  function handleRemoveQuoteItem(itemId: string) {
    const newItems = quoteItems.filter((i) => i.id !== itemId);
    setQuoteItems(newItems);
    save(newItems, discountPct);
  }

  function handleQuotePriceChange(itemId: string, newPrice: string) {
    const val = parseFloat(newPrice) || 0;
    const newItems = quoteItems.map((i) => i.id === itemId ? { ...i, price: val } : i);
    setQuoteItems(newItems);
    save(newItems, discountPct);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = quoteItems.findIndex((i) => i.id === active.id);
    const newIndex = quoteItems.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(quoteItems, oldIndex, newIndex);
    setQuoteItems(newItems);
    save(newItems, discountPct);
  }

  function handleDiscountChange(val: string) {
    const pct = Math.min(100, Math.max(0, parseFloat(val) || 0));
    setDiscountPct(pct);
    save(quoteItems, pct);
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800 dark:text-white">Odontograma</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("inicial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "inicial"
              ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
          }`}
        >
          <Stethoscope size={15} />
          Odontograma Inicial
        </button>
        <button
          onClick={() => setActiveTab("tratamiento")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "tratamiento"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <ClipboardList size={15} />
          Plan de Tratamiento
        </button>
      </div>

      {/* Tab description */}
      {activeTab === "inicial" ? (
        <p className="text-xs text-slate-400 dark:text-gray-500 -mt-2">
          Registra el estado dental del paciente en su primera visita.
        </p>
      ) : (
        <p className="text-xs text-slate-400 dark:text-gray-500 -mt-2">
          Marca las intervenciones planificadas para el paciente.
        </p>
      )}

      {/* Odontogram section — key forces remount when tab changes so state resets */}
      <OdontogramSection key={activeTab} patientId={id} kind={activeTab} />

      {/* Cotización */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <Calculator size={17} className="text-slate-500 dark:text-gray-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Cotización del plan de tratamiento</h2>
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700">
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1">Pieza (opcional)</label>
              <input
                type="number"
                placeholder="Ej: 16"
                value={addTooth}
                onChange={(e) => setAddTooth(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1">Procedimiento *</label>
              <select
                value={addProc}
                onChange={(e) => setAddProc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">Seleccionar...</option>
                {procedures.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    {idx + 1}. {p.name}{(priceByProcedureId.get(p.id) ?? p.default_price) != null ? ` — C$ ${Number(priceByProcedureId.get(p.id) ?? p.default_price).toLocaleString("es-NI")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={handleAddQuoteItem} disabled={!addProc}>
              <Plus size={15} /> Agregar
            </Button>
          </div>
        </div>

        {quoteItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-gray-500">
            Agrega procedimientos para calcular el costo del tratamiento.
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            <div className="grid grid-cols-12 px-5 py-2 text-xs font-medium text-slate-400 dark:text-gray-500 bg-slate-50 dark:bg-gray-700/50">
              <span className="col-span-1">#</span>
              <span className="col-span-1">Pieza</span>
              <span className="col-span-5">Procedimiento</span>
              <span className="col-span-4 text-right">Precio (C$)</span>
              <span className="col-span-1" />
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={quoteItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {quoteItems.map((item, idx) => (
                  <SortableQuoteRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    onPriceChange={handleQuotePriceChange}
                    onRemove={handleRemoveQuoteItem}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Footer: descuento + total — siempre visible */}
        <div className="border-t-2 border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50">
          {/* Fila de descuento */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-orange-500" />
              <span className="text-sm text-slate-600 dark:text-gray-300">Descuento</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={discountPct || ""}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder="0"
                className="w-16 text-right rounded border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <span className="text-sm text-slate-500 dark:text-gray-400">%</span>
              {discountPct > 0 && (
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium w-28 text-right">
                  − C$ {fmtNIO(discountAmt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs text-slate-400 dark:text-gray-500">{quoteItems.length} procedimiento(s)</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Paciente: {patient?.full_name}</p>
            </div>
            <div className="text-right">
              {discountPct > 0 && (
                <p className="text-xs text-slate-400 dark:text-gray-500 mb-0.5 line-through">
                  C$ {fmtNIO(subtotal)}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">Total estimado</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                C$ {fmtNIO(quoteTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
