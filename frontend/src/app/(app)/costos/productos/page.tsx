"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Minus, Trash2, Search, X, Edit2, Package, Calculator, ChevronRight, GripVertical, ImagePlus, Users, Loader2, Check, Settings2, AlertTriangle, Download, Upload, CheckCircle2, AlertCircle, Link2, History, CheckCircle, XCircle, Layers } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCostProducts,
  useCostTreatments,
  useCreateCostProduct,
  useUpdateCostProduct,
  useDeleteCostProduct,
  useReorderCostProducts,
  useProductPatientUsage,
  useRenameCostCategory,
  useDeleteCostCategory,
  useDeleteCostProducts,
  useImportCostProducts,
  useUpdateCostAppointment,
  useUpdateCostProductStock,
  useUpdateCostProductMinStock,
  useProductLots,
  useOpenProductLot,
  useUpdateProductLot,
  useFinishProductLot,
  useDeleteProductLot,
  ApiProduct,
  ApiProductLot,
  type ImportResult,
} from "@/hooks/useCostos";
import {
  ProductCategory,
  PRODUCT_CATEGORY_LABELS,
  categoryLabel,
  categoryColor,
  PRESENTATION_UNITS,
} from "@/types/costos";
import { fmtC, fmtUSD, fmt } from "@/lib/costos-utils";
import { useClinicSettings } from "@/hooks/useSettings";
import { fmtDate, useEscapeKey, normalizeSearch } from "@/lib/utils";
import Button from "@/components/ui/Button";

const ALL_CATEGORIES: ProductCategory[] = [
  "desechable", "anestesia", "endodoncia", "restauracion", "profilaxis", "instrumental", "otros",
];

function calcPortions(presentationQty?: number, portionQty?: number): number | null {
  if (!presentationQty || !portionQty || portionQty <= 0) return null;
  return presentationQty / portionQty;
}

function calcUnitPrice(totalCost?: number, portions?: number | null): number | null {
  if (!totalCost || !portions || portions <= 0) return null;
  return totalCost / portions;
}

// ─── Inventario helpers ───────────────────────────────────────────────────────

type StockStatus = "ok" | "low" | "empty" | "unconfigured";

function getStatus(p: ApiProduct): StockStatus {
  if (p.stock_qty == null) return "unconfigured";
  if (p.stock_qty <= 0) return "empty";
  if (p.min_stock_qty != null && p.stock_qty <= p.min_stock_qty) return "low";
  return "ok";
}

const STATUS_CFG: Record<StockStatus, { label: string; icon: React.ElementType; color: string; bg: string; dot: string }> = {
  ok:           { label: "OK",        icon: CheckCircle,   color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20",  dot: "bg-green-500" },
  low:          { label: "Alerta",    icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20",  dot: "bg-amber-500" },
  empty:        { label: "Agotado",   icon: XCircle,       color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-900/20",      dot: "bg-red-500"   },
  unconfigured: { label: "Sin stock", icon: Package,       color: "text-slate-400 dark:text-gray-500",  bg: "bg-slate-50 dark:bg-gray-700/50",   dot: "bg-slate-300" },
};

function stockLabel(p: ApiProduct): string {
  if (p.stock_qty == null) return "—";
  return `${fmt(p.stock_qty)} ${p.presentation_unit ?? "usos"}`;
}

function usosLabel(p: ApiProduct): string {
  if (p.stock_qty == null || !p.portion_qty) return "";
  return `≈ ${fmt(p.stock_qty / p.portion_qty)} usos`;
}

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
  useEffect(() => { setRaw(toDisplay(value)); }, [value]);
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; setRaw(v);
    const iso = toISO(v); if (iso) onChange(iso);
  }
  return (
    <input type="text" value={raw} onChange={handleChange} placeholder="DD/MM/AAAA" maxLength={10} className={className} />
  );
}

// ─── Modal ajuste de stock ────────────────────────────────────────────────────

function AdjustModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  useEscapeKey(onClose);
  const updateStock = useUpdateCostProductStock();
  const updateMinStock = useUpdateCostProductMinStock();
  const unit = product.presentation_unit ?? "unidades";
  const portionSize = product.portion_qty ?? 1;
  const presentationSize = product.presentation_qty ?? 1;
  const [recibirQty, setRecibirQty] = useState("");
  const [ajusteQty, setAjusteQty] = useState(product.stock_qty != null ? String(product.stock_qty) : "");
  const [minQty, setMinQty] = useState(product.min_stock_qty != null ? String(product.min_stock_qty) : "");

  function handleRecibir() {
    const n = parseFloat(recibirQty); if (!n || n <= 0) return;
    updateStock.mutate({ id: product.id, qty: n * presentationSize, operation: "add" });
    onClose();
  }
  function handleAjustar() {
    const n = parseFloat(ajusteQty); if (isNaN(n) || n < 0) return;
    updateStock.mutate({ id: product.id, qty: n, operation: "set" });
    const min = parseFloat(minQty);
    updateMinStock.mutate({ id: product.id, min_qty: isNaN(min) || minQty === "" ? null : min });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Ajustar stock — {product.name}</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
            Stock actual: <strong>{stockLabel(product)}</strong>
            {product.portion_qty && <> · {usosLabel(product)}</>}
          </p>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl border border-blue-100 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/20 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Recibir mercancía nueva</p>
            {product.presentation_qty ? (
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Cada unidad = {fmt(presentationSize)} {unit}
                {product.portion_qty && <> · {fmt(presentationSize / portionSize)} usos</>}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="1" value={recibirQty} onChange={(e) => setRecibirQty(e.target.value)}
                placeholder={product.presentation_qty ? "ej. 2 frascos" : `ej. 500 ${unit}`}
                className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-sm text-slate-400 dark:text-gray-500 whitespace-nowrap">
                {product.presentation_qty ? "frascos/unidades" : unit}
              </span>
            </div>
            {recibirQty && parseFloat(recibirQty) > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400">+ {fmt(parseFloat(recibirQty) * presentationSize)} {unit} al stock</p>
            )}
            <button onClick={handleRecibir} disabled={!recibirQty || parseFloat(recibirQty) <= 0}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
              <Plus size={14} className="inline mr-1" /> Agregar al stock
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Ajuste manual (conteo físico)</p>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Stock actual en {unit}</label>
              <input type="number" min="0" step="any" value={ajusteQty} onChange={(e) => setAjusteQty(e.target.value)} placeholder="0"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Stock mínimo para alerta (en {unit})</label>
              <input type="number" min="0" step="any" value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleAjustar}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
              Guardar ajuste
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="w-full text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal historial de lotes ─────────────────────────────────────────────────

function LotHistoryModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  useEscapeKey(onClose);
  const today = new Date().toISOString().slice(0, 10);
  const { data: lots = [], isLoading } = useProductLots(product.id);
  const openLot = useOpenProductLot();
  const finishLot = useFinishProductLot();
  const deleteLot = useDeleteProductLot();
  const updateLot = useUpdateProductLot();

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openedAt, setOpenedAt] = useState(today);
  const [expectedPortions, setExpectedPortions] = useState("");
  const [lotNotes, setLotNotes] = useState("");
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState(today);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editOpenedAt, setEditOpenedAt] = useState("");
  const [editExpected, setEditExpected] = useState("");
  const [editNotes, setEditNotes] = useState("");

  function startEdit(lot: ApiProductLot) {
    setEditingLotId(lot.id);
    setEditOpenedAt((lot.opened_at ?? "").slice(0, 10));
    setEditExpected(lot.expected_portions != null ? String(lot.expected_portions) : "");
    setEditNotes(lot.notes ?? "");
    setFinishingId(null);
  }
  function saveEdit(lot: ApiProductLot) {
    updateLot.mutate({
      productId: product.id, lotId: lot.id,
      opened_at: editOpenedAt,
      expected_portions: editExpected ? parseFloat(editExpected) : null,
      notes: editNotes || null,
    }, { onSuccess: () => setEditingLotId(null) });
  }

  const activeLot = lots.find((l) => !l.finished_at);
  const pastLots = lots.filter((l) => l.finished_at);

  function handleOpenLot() {
    openLot.mutate({ productId: product.id, opened_at: openedAt, expected_portions: expectedPortions ? parseFloat(expectedPortions) : null, notes: lotNotes || null });
    setShowOpenForm(false); setExpectedPortions(""); setLotNotes(""); setOpenedAt(today);
  }

  function efficiency(lot: ApiProductLot): string | null {
    if (!lot.expected_portions || !lot.finished_at) return null;
    const pct = ((lot.used_portions - lot.expected_portions) / lot.expected_portions) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(0) + "% vs esperado";
  }

  const inputCls = "w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] flex flex-col">
        <div className="border-b border-slate-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Historial de lotes</h2>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Lote activo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Lote activo</p>
              {!activeLot && !showOpenForm && (
                <button onClick={() => setShowOpenForm(true)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <Plus size={12} /> Abrir nuevo lote
                </button>
              )}
            </div>
            {isLoading ? (
              <p className="text-xs text-slate-400 dark:text-gray-500">Cargando...</p>
            ) : activeLot ? (
              <div className="rounded-xl border border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10 p-4 space-y-3">
                {editingLotId === activeLot.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Fecha apertura</label>
                        <DateInput value={editOpenedAt} onChange={setEditOpenedAt} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Porciones esperadas</label>
                        <input type="number" min="0" step="any" value={editExpected} onChange={(e) => setEditExpected(e.target.value)} placeholder="Ej. 100" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Notas</label>
                      <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Marca, lote..." className={inputCls} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(activeLot)} disabled={updateLot.isPending}
                        className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">Guardar cambios</button>
                      <button onClick={() => setEditingLotId(null)} className="rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-gray-200">Abierto el {fmtDate(activeLot.opened_at, { showWeekday: false })}</p>
                        {activeLot.notes && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{activeLot.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => startEdit(activeLot)} className="rounded p-1 text-slate-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar"><Edit2 size={13} /></button>
                        <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">En uso</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-gray-400">
                        <span>Porciones usadas: <strong>{activeLot.used_portions.toFixed(1)}</strong></span>
                        {activeLot.expected_portions && <span>Esperadas: <strong>{activeLot.expected_portions}</strong></span>}
                      </div>
                      {activeLot.expected_portions && (
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, (activeLot.used_portions / activeLot.expected_portions) * 100).toFixed(0)}%` }} />
                        </div>
                      )}
                    </div>
                    {finishingId === activeLot.id ? (
                      <div className="flex items-center gap-2 pt-1">
                        <DateInput value={finishedAt} onChange={setFinishedAt} className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm" />
                        <button onClick={() => { finishLot.mutate({ productId: product.id, lotId: activeLot.id, finished_at: finishedAt }); setFinishingId(null); }}
                          className="rounded-lg bg-slate-700 dark:bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-gray-500">Confirmar</button>
                        <button onClick={() => setFinishingId(null)} className="text-xs text-slate-400 dark:text-gray-500">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setFinishingId(activeLot.id)}
                        className="w-full rounded-lg border border-slate-300 dark:border-gray-600 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                        Marcar como agotado
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : !showOpenForm ? (
              <p className="text-xs text-slate-400 dark:text-gray-500 italic">No hay lote activo.</p>
            ) : null}

            {showOpenForm && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Abrir nuevo lote</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Fecha apertura</label>
                    <DateInput value={openedAt} onChange={setOpenedAt} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Porciones esperadas</label>
                    <input type="number" min="0" step="any" value={expectedPortions} onChange={(e) => setExpectedPortions(e.target.value)} placeholder="Ej. 100" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Notas (opcional)</label>
                  <input type="text" value={lotNotes} onChange={(e) => setLotNotes(e.target.value)} placeholder="Marca, número de lote..." className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleOpenLot} disabled={openLot.isPending}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">Abrir lote</button>
                  <button onClick={() => setShowOpenForm(false)} className="rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Historial */}
          {pastLots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-2">Historial</p>
              <div className="space-y-2">
                {pastLots.map((lot) => {
                  const eff = efficiency(lot);
                  return (
                    <div key={lot.id} className="rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 p-3">
                      {editingLotId === lot.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Fecha apertura</label>
                              <DateInput value={editOpenedAt} onChange={setEditOpenedAt} className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Porciones esperadas</label>
                              <input type="number" min="0" step="any" value={editExpected} onChange={(e) => setEditExpected(e.target.value)} placeholder="Ej. 100" className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-xs" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Notas</label>
                            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Opcional" className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-xs" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(lot)} disabled={updateLot.isPending} className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">Guardar</button>
                            <button onClick={() => setEditingLotId(null)} className="rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-400">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-gray-300">
                              {fmtDate(lot.opened_at, { showWeekday: false })} → {lot.finished_at ? fmtDate(lot.finished_at, { showWeekday: false }) : "—"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              {lot.used_portions.toFixed(1)} porciones{lot.expected_portions && <> · esperadas: {lot.expected_portions}</>}
                            </p>
                            {eff && <p className={`text-xs font-medium mt-0.5 ${eff.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>{eff}</p>}
                            {lot.notes && <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{lot.notes}</p>}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => startEdit(lot)} className="rounded p-1 text-slate-300 dark:text-gray-600 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar"><Edit2 size={12} /></button>
                            <button onClick={() => deleteLot.mutate({ productId: product.id, lotId: lot.id })} className="rounded p-1 text-slate-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar"><X size={12} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!isLoading && lots.length === 0 && !showOpenForm && (
            <p className="text-center text-xs text-slate-400 dark:text-gray-500 py-4">Sin historial. Abre el primer lote para comenzar a rastrear el rendimiento.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ProductFormState {
  name: string;
  category: string;
  supplier: string;
  notes: string;
  totalCost: string;
  presentationQty: string;
  presentationUnit: string;
  portionQty: string;
  manualUnitPrice: string;
  purchaseDate: string;
  imageUrl: string;
}

const EMPTY_FORM: ProductFormState = {
  name: "", category: "desechable", supplier: "", notes: "",
  totalCost: "", presentationQty: "", presentationUnit: "ml", portionQty: "", manualUnitPrice: "",
  purchaseDate: "", imageUrl: "",
};

function productToForm(p: ApiProduct): ProductFormState {
  return {
    name: p.name, category: p.category as ProductCategory,
    supplier: p.supplier ?? "", notes: p.notes ?? "",
    totalCost: p.total_cost != null ? String(p.total_cost) : "",
    presentationQty: p.presentation_qty != null ? String(p.presentation_qty) : "",
    presentationUnit: p.presentation_unit ?? "ml",
    portionQty: p.portion_qty != null ? String(p.portion_qty) : "",
    manualUnitPrice: String(p.unit_price),
    purchaseDate: p.purchase_date ?? "",
    imageUrl: p.image_url ?? "",
  };
}

function compressImage(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CUSTOM_SENTINEL = "__custom__";

function ManageCategoriesModal({ categories, onClose }: { categories: string[]; onClose: () => void }) {
  useEscapeKey(onClose);
  const renameCategory = useRenameCostCategory();
  const deleteCategory = useDeleteCostCategory();
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function handleRename(oldCat: string) {
    const newCat = editValue.trim();
    if (!newCat || newCat === oldCat) { setEditingCat(null); return; }
    renameCategory.mutate({ from_category: oldCat, to_category: newCat }, {
      onSuccess: () => setEditingCat(null),
    });
  }

  function handleDelete(cat: string) {
    const msg = `¿Eliminar la categoría "${categoryLabel(cat)}"? Los productos se moverán a "Otros".`;
    if (!confirm(msg)) return;
    deleteCategory.mutate({ category: cat });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Gestionar categorías</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-700">
          {categories.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">No hay categorías</p>
          )}
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2 py-2.5">
              {editingCat === cat ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(cat); if (e.key === "Escape") setEditingCat(null); }}
                    className="flex-1 rounded-lg border border-blue-400 ring-2 ring-blue-100 dark:ring-blue-800 px-2 py-1.5 text-sm focus:outline-none dark:bg-gray-700 dark:text-white dark:border-blue-500"
                  />
                  <button onClick={() => handleRename(cat)} className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"><Check size={13} /></button>
                  <button onClick={() => setEditingCat(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(cat)}`}>{categoryLabel(cat)}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => { setEditingCat(cat); setEditValue(cat); }}
                      className="rounded p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      title="Renombrar"
                    ><Edit2 size={13} /></button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deleteCategory.isPending}
                      className="rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                      title="Eliminar"
                    ><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="w-full rounded-xl border border-slate-200 dark:border-gray-600 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ initial, extraCategories, onSave, onClose, onManageCategories }: { initial?: ApiProduct; extraCategories: string[]; onSave: (data: Omit<ApiProduct, "id" | "sort_order" | "stock_qty" | "min_stock_qty">) => void; onClose: () => void; onManageCategories: () => void }) {
  useEscapeKey(onClose);
  const [form, setForm] = useState<ProductFormState>(initial ? productToForm(initial) : EMPTY_FORM);
  const f = (key: keyof ProductFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const [showCustomInput, setShowCustomInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await compressImage(file);
    setForm((s) => ({ ...s, imageUrl: dataUrl }));
  }

  const allSelectableCategories = [
    ...ALL_CATEGORIES,
    ...extraCategories.filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)),
    ...(form.category && !ALL_CATEGORIES.includes(form.category as ProductCategory) && !extraCategories.includes(form.category) ? [form.category] : []),
  ];

  const pQty = parseFloat(form.presentationQty) || 0;
  const portQty = parseFloat(form.portionQty) || 0;
  const tCost = parseFloat(form.totalCost) || 0;
  const portions = calcPortions(pQty || undefined, portQty || undefined);
  const autoPrice = calcUnitPrice(tCost || undefined, portions);
  const hasCalc = pQty > 0 && portQty > 0 && tCost > 0;
  const effectiveUnitPrice = hasCalc && autoPrice != null ? autoPrice : (parseFloat(form.manualUnitPrice) || 0);

  function handleSave() {
    if (!form.name.trim()) return;
    const presentation = pQty > 0 ? `${fmt(pQty)}${form.presentationUnit}` : (form.manualUnitPrice ? `C$${form.manualUnitPrice}/unidad` : "");
    const portionDescription = portQty > 0 ? `${fmt(portQty)}${form.presentationUnit}/uso` : "";
    onSave({
      name: form.name.trim(), category: form.category,
      supplier: form.supplier.trim() || undefined,
      notes: form.notes.trim() || undefined,
      unit_price: effectiveUnitPrice, presentation, portion_description: portionDescription,
      total_cost: tCost || undefined,
      presentation_qty: pQty || undefined,
      presentation_unit: pQty > 0 ? form.presentationUnit : undefined,
      portion_qty: portQty || undefined,
      purchase_date: form.purchaseDate || null,
      image_url: form.imageUrl || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="font-semibold text-slate-800 dark:text-white">{initial ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Nombre del producto *</label>
              <input autoFocus value={form.name} onChange={f("name")} placeholder="ej. Composite Bulk Fill A2"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Categoría</label>
                {showCustomInput ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={form.category}
                      onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                      placeholder="Nombre de categoría"
                      className="flex-1 min-w-0 rounded-lg border border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-700 px-3 py-2 text-sm focus:outline-none dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => { setShowCustomInput(false); setForm((s) => ({ ...s, category: "otros" })); }}
                      className="shrink-0 rounded-lg border border-slate-200 dark:border-gray-600 px-2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs"
                      title="Volver a lista"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <select
                      value={form.category}
                      onChange={(e) => {
                        if (e.target.value === CUSTOM_SENTINEL) { setShowCustomInput(true); setForm((s) => ({ ...s, category: "" })); }
                        else { setForm((s) => ({ ...s, category: e.target.value })); }
                      }}
                      className="flex-1 h-9 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {allSelectableCategories.map((c) => (
                        <option key={c} value={c}>
                          {PRODUCT_CATEGORY_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                      <option value={CUSTOM_SENTINEL}>+ Nueva categoría…</option>
                    </select>
                    <button
                      type="button"
                      onClick={onManageCategories}
                      title="Gestionar categorías"
                      className="shrink-0 h-9 rounded-lg border border-slate-200 dark:border-gray-600 px-2 text-slate-400 dark:text-gray-500 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Proveedor</label>
                <input value={form.supplier} onChange={f("supplier")} placeholder="ej. INDENT"
                  className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 dark:border-blue-800/30 bg-blue-50/40 dark:bg-blue-900/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Calculadora de costo por uso</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Presentación total del producto</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="any" value={form.presentationQty} onChange={f("presentationQty")} placeholder="ej. 1000"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={form.presentationUnit} onChange={f("presentationUnit")} className="w-28 h-9 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRESENTATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Cantidad usada por porción / cita</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="any" value={form.portionQty} onChange={f("portionQty")} placeholder="ej. 7"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex h-9 w-28 items-center justify-center rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-gray-700 text-sm text-slate-500 dark:text-gray-400">{form.presentationUnit}</div>
              </div>
            </div>
            {portions != null && (
              <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-white/5 border border-blue-100 dark:border-blue-800/30 px-4 py-3 text-sm">
                <span className="text-slate-500 dark:text-gray-400">{fmt(pQty)}{form.presentationUnit} ÷ {fmt(portQty)}{form.presentationUnit} =</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 text-base">≈ {fmt(portions)} usos</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Costo del producto completo (C$)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">C$</span>
                <input type="number" min="0" step="0.01" value={form.totalCost} onChange={f("totalCost")} placeholder="ej. 350.00"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {hasCalc && autoPrice != null ? (
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-green-700 dark:text-green-400">{fmtC(tCost)} ÷ {fmt(portions!)} usos</div>
                  <ChevronRight size={14} className="text-green-400" />
                  <div className="text-lg font-bold text-green-800 dark:text-green-300">{fmtC(autoPrice)} / uso</div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Costo por porción / uso (C$) — manual</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 dark:text-gray-500">C$</span>
                  <input type="number" min="0" step="0.01" value={form.manualUnitPrice} onChange={f("manualUnitPrice")} placeholder="0.00"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Fecha de compra</label>
              <input type="date" value={form.purchaseDate} onChange={f("purchaseDate")}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Notas (opcional)</label>
            <textarea value={form.notes} onChange={f("notes")} rows={2} placeholder="Observaciones, marca, referencia..."
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-2">Foto del producto (opcional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
            {form.imageUrl ? (
              <div className="flex items-start gap-3">
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="h-24 w-24 rounded-xl object-cover border border-slate-200 dark:border-gray-600"
                />
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-slate-300 dark:border-gray-600 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                  >
                    Cambiar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, imageUrl: "" }))}
                    className="rounded-lg border border-red-200 dark:border-red-800/50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Eliminar foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-600 py-6 text-center hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
              >
                <ImagePlus size={22} className="text-slate-300 dark:text-gray-600" />
                <p className="text-xs text-slate-400 dark:text-gray-500">Haz clic o arrastra una imagen aquí</p>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 dark:border-gray-700 px-6 py-4 sticky bottom-0 bg-white dark:bg-gray-800">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim() || (!hasCalc && !form.manualUnitPrice)}>
            {initial ? "Guardar cambios" : "Agregar producto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de uso por paciente ────────────────────────────────────────────────

function ProductUsageModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  useEscapeKey(onClose);
  const { data: usage = [], isLoading } = useProductPatientUsage(product.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Uso por paciente</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400 dark:text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : usage.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Users size={28} className="text-slate-200 dark:text-gray-600" />
              <p className="text-sm text-slate-500 dark:text-gray-400">Este material no está vinculado a ningún procedimiento registrado en finanzas.</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 max-w-xs">
                Para rastrear su uso, vincula su tratamiento de costos a un procedimiento del catálogo y registra los cobros en el módulo de Finanzas.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400 sticky top-0">
                  <th className="px-5 py-3 text-left font-medium">Paciente</th>
                  <th className="px-4 py-3 text-left font-medium">Procedimiento</th>
                  <th className="px-4 py-3 text-center font-medium">Fecha</th>
                  <th className="px-5 py-3 text-right font-medium">Porciones usadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                {usage.map((row) => (
                  <tr key={row.transaction_id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-700 dark:text-gray-300">{row.patient_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-600 dark:text-gray-400">{row.procedure_name ?? "—"}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500">{row.treatment_name}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 dark:text-gray-400 tabular-nums">
                      {fmtDate(row.date, { showWeekday: false })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-semibold text-slate-800 dark:text-white tabular-nums">
                        {row.total_quantity % 1 === 0 ? row.total_quantity : row.total_quantity.toFixed(2)}
                      </p>
                      {row.procedure_quantity > 1 && (
                        <p className="text-xs text-slate-400 dark:text-gray-500">
                          {row.qty_per_procedure % 1 === 0 ? row.qty_per_procedure : row.qty_per_procedure.toFixed(2)} × {row.procedure_quantity}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50">
                  <td colSpan={3} className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-gray-400">
                    Total — {usage.length} registro{usage.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-white tabular-nums">
                    {(() => { const t = usage.reduce((s, r) => s + r.total_quantity, 0); return t % 1 === 0 ? t : t.toFixed(2); })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de tratamientos vinculados ─────────────────────────────────────────

interface LinkedTreatmentInfo {
  treatmentId: string;
  treatmentName: string;
  appointmentId: string;
  appointmentName: string;
  quantity: number;
}

function ProductLinksModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  useEscapeKey(onClose);
  const { data: treatments = [], isLoading } = useCostTreatments();
  const { data: products = [] } = useCostProducts();
  const updateAppointment = useUpdateCostAppointment();

  const links = useMemo<LinkedTreatmentInfo[]>(() => {
    const seen = new Set<string>();
    const result: LinkedTreatmentInfo[] = [];
    for (const t of treatments) {
      for (const a of t.appointments) {
        if (seen.has(a.id)) continue;
        const totalQty = a.materials
          .filter((m) => m.productId === product.id)
          .reduce((s, m) => s + m.quantity, 0);
        if (totalQty > 0) {
          seen.add(a.id);
          result.push({
            treatmentId: t.id,
            treatmentName: t.name,
            appointmentId: a.id,
            appointmentName: a.name,
            quantity: totalQty,
          });
        }
      }
    }
    return result;
  }, [treatments, product.id]);

  const [replacingAptId, setReplacingAptId] = useState<string | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [selectedNewProductId, setSelectedNewProductId] = useState("");

  const otherProducts = products.filter((p) => p.id !== product.id);
  const filteredForReplace = replaceSearch.trim()
    ? otherProducts.filter((p) => normalizeSearch(p.name).includes(normalizeSearch(replaceSearch)))
    : otherProducts;

  function cancelReplace() {
    setReplacingAptId(null);
    setReplaceSearch("");
    setSelectedNewProductId("");
  }

  function handleUnlink(link: LinkedTreatmentInfo) {
    if (!confirm(`¿Desvincular "${product.name}" de "${link.treatmentName} — ${link.appointmentName}"?`)) return;
    const t = treatments.find((tr) => tr.id === link.treatmentId);
    const a = t?.appointments.find((ap) => ap.id === link.appointmentId);
    if (!a) return;
    const newMaterials = a.materials.filter((m) => m.productId !== product.id);
    updateAppointment.mutate(
      { treatmentId: link.treatmentId, aptId: link.appointmentId, materials: newMaterials },
      { onSuccess: () => toast.success("Material desvinculado.") }
    );
  }

  function handleReplace(link: LinkedTreatmentInfo) {
    if (!selectedNewProductId) return;
    const t = treatments.find((tr) => tr.id === link.treatmentId);
    const a = t?.appointments.find((ap) => ap.id === link.appointmentId);
    if (!a) return;
    const newMaterials = a.materials.map((m) =>
      m.productId === product.id ? { ...m, productId: selectedNewProductId } : m
    );
    updateAppointment.mutate(
      { treatmentId: link.treatmentId, aptId: link.appointmentId, materials: newMaterials },
      {
        onSuccess: () => {
          cancelReplace();
          toast.success("Material reemplazado.");
        },
      }
    );
  }

  const uniqueTreatmentCount = new Set(links.map((l) => l.treatmentId)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Tratamientos vinculados</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Link2 size={28} className="text-slate-200 dark:text-gray-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-gray-400">Sin vínculos</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 max-w-xs">
                Este producto no está vinculado a ningún tratamiento de costos operativos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.appointmentId} className="rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{link.treatmentName}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {link.appointmentName} · <span className="font-medium">{link.quantity % 1 === 0 ? link.quantity : link.quantity.toFixed(2)}</span> {link.quantity === 1 ? "uso" : "usos"}
                      </p>
                    </div>
                    {replacingAptId !== link.appointmentId && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setReplacingAptId(link.appointmentId); setReplaceSearch(""); setSelectedNewProductId(""); }}
                          className="rounded-lg border border-slate-200 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          Reemplazar...
                        </button>
                        <button
                          onClick={() => handleUnlink(link)}
                          disabled={updateAppointment.isPending}
                          className="rounded-lg border border-red-100 dark:border-red-800/40 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 transition-colors"
                        >
                          Desvincular
                        </button>
                      </div>
                    )}
                  </div>

                  {replacingAptId === link.appointmentId && (
                    <div className="mt-3 space-y-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Buscar nuevo producto..."
                        value={replaceSearch}
                        onChange={(e) => { setReplaceSearch(e.target.value); setSelectedNewProductId(""); }}
                        className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {filteredForReplace.length > 0 && (
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-slate-50 dark:divide-gray-700">
                          {filteredForReplace.slice(0, 30).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedNewProductId(p.id)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedNewProductId === p.id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"}`}
                            >
                              {p.name}
                              {p.supplier && <span className="text-xs text-slate-400 dark:text-gray-500 ml-1.5">· {p.supplier}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {replaceSearch.trim() && filteredForReplace.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-gray-500 px-1">Sin resultados para &ldquo;{replaceSearch}&rdquo;</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleReplace(link)}
                          disabled={!selectedNewProductId || updateAppointment.isPending}
                          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {updateAppointment.isPending && <Loader2 size={12} className="animate-spin" />}
                          Confirmar reemplazo
                        </button>
                        <button
                          onClick={cancelReplace}
                          className="rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-gray-700 px-6 py-4 shrink-0">
          {links.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-gray-500 mb-3">
              {links.length} cita{links.length !== 1 ? "s" : ""} en {uniqueTreatmentCount} tratamiento{uniqueTreatmentCount !== 1 ? "s" : ""}
            </p>
          )}
          <button onClick={onClose} className="w-full rounded-xl border border-slate-200 dark:border-gray-600 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila sortable ────────────────────────────────────────────────────────────

function SortableProductRow({ product, onEdit, onViewUsage, onViewLinks, onAdjust, onLots, isDragDisabled, exchangeRate, rowNumber, isSelected, onSelect }: { product: ApiProduct; onEdit: () => void; onViewUsage: () => void; onViewLinks: () => void; onAdjust: () => void; onLots: () => void; isDragDisabled: boolean; exchangeRate: number; rowNumber: number; isSelected: boolean; onSelect: (shiftKey: boolean) => void }) {
  const deleteProduct = useDeleteCostProduct();
  const updateStock = useUpdateCostProductStock();
  const portions = calcPortions(product.presentation_qty, product.portion_qty);
  const hasCalc = portions != null && product.total_cost != null;
  const status = getStatus(product);
  const { label: statusLabel, icon: StatusIcon, color: statusColor, bg: statusBg } = STATUS_CFG[status];
  const portionSize = product.presentation_qty ?? 1;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id, disabled: isDragDisabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };

  return (
    <tr ref={setNodeRef} style={style} className={`group border-b border-slate-50 dark:border-gray-700 ${isSelected ? "bg-blue-50/70 dark:bg-blue-900/20" : "hover:bg-slate-50/50 dark:hover:bg-gray-700/50"}`}>
      <td className="pl-3 py-3 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
          className="rounded border-slate-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-600"
        />
      </td>
      <td className="pl-2 pr-1 py-3 w-7">
        {!isDragDisabled && (
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing rounded p-0.5 text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 touch-none" title="Arrastrar">
            <GripVertical size={14} />
          </button>
        )}
      </td>
      <td className="pr-2 py-3 text-right tabular-nums text-xs text-slate-400 dark:text-gray-500 w-8 select-none">{rowNumber}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-9 w-9 rounded-lg object-cover border border-slate-100 dark:border-gray-700 shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <Package size={14} className="text-slate-300 dark:text-gray-500" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-800 dark:text-white">{product.name}</p>
            {product.supplier && <p className="text-xs text-slate-400 dark:text-gray-500">{product.supplier}</p>}
            {product.purchase_date && <p className="text-xs text-slate-400 dark:text-gray-500">Comprado: {fmtDate(product.purchase_date, { showWeekday: false })}</p>}
            {product.notes && <p className="text-xs text-slate-300 dark:text-gray-600 italic truncate max-w-[160px]">{product.notes}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(product.category)}`}>
          {categoryLabel(product.category)}
        </span>
      </td>
      <td className="px-4 py-3">
        {hasCalc ? (
          <div className="text-xs space-y-0.5">
            <p className="text-slate-600 dark:text-gray-400"><span className="font-medium">{fmt(product.presentation_qty!)}{product.presentation_unit}</span> total · {fmt(product.portion_qty!)}{product.presentation_unit}/uso</p>
            <p className="text-slate-400 dark:text-gray-500">≈ {fmt(portions!)} usos por frasco</p>
          </div>
        ) : product.presentation ? (
          <span className="text-sm text-slate-500 dark:text-gray-400">{product.presentation}</span>
        ) : <span className="text-slate-300 dark:text-gray-600">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {product.total_cost != null ? (
          <div>
            <p className="text-sm text-slate-600 dark:text-gray-400 tabular-nums">{fmtC(product.total_cost)}</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 tabular-nums">{fmtUSD(product.total_cost, exchangeRate)}</p>
          </div>
        ) : <span className="text-slate-300 dark:text-gray-600 text-sm">—</span>}
      </td>
      <td className="px-5 py-3 text-right">
        <p className="font-semibold text-slate-800 dark:text-white tabular-nums">{fmtC(product.unit_price)}</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 tabular-nums">{fmtUSD(product.unit_price, exchangeRate)}</p>
        {hasCalc && <p className="text-[10px] text-green-600 dark:text-green-400">calculado</p>}
      </td>
      <td className="px-4 py-3">
        {product.stock_qty != null ? (
          <div>
            <p className="font-semibold text-slate-800 dark:text-gray-200 tabular-nums text-sm">{stockLabel(product)}</p>
            {product.portion_qty && <p className="text-xs text-slate-400 dark:text-gray-500">{usosLabel(product)}</p>}
          </div>
        ) : (
          <span className="text-xs text-slate-300 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400 dark:text-gray-500 tabular-nums">
        {product.min_stock_qty != null ? `${fmt(product.min_stock_qty)} ${product.presentation_unit ?? "usos"}` : <span className="text-slate-200 dark:text-gray-700">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBg} ${statusColor}`}>
          <StatusIcon size={11} /> {statusLabel}
        </span>
      </td>
      <td className="pr-3 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onViewUsage} className="rounded p-1.5 text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-500" title="Ver uso por paciente"><Users size={13} /></button>
          <button onClick={onViewLinks} className="rounded p-1.5 text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-500" title="Ver tratamientos vinculados"><Link2 size={13} /></button>
          {product.presentation_qty && (
            <>
              <button onClick={() => updateStock.mutate({ id: product.id, qty: portionSize, operation: "add" })}
                title={`+1 (${fmt(portionSize)} ${product.presentation_unit ?? "u"})`}
                className="rounded p-1.5 text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600"><Plus size={13} /></button>
              <button onClick={() => updateStock.mutate({ id: product.id, qty: -portionSize, operation: "add" })}
                title="-1"
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500"><Minus size={13} /></button>
            </>
          )}
          <button onClick={onAdjust} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500" title="Ajustar stock"><Layers size={13} /></button>
          <button onClick={onLots} className="rounded p-1.5 text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-500" title="Historial de lotes"><History size={13} /></button>
          <button onClick={onEdit} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500" title="Editar"><Edit2 size={13} /></button>
          <button onClick={() => { if (confirm(`¿Eliminar "${product.name}"?`)) deleteProduct.mutate(product.id); }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Fila de inventario ───────────────────────────────────────────────────────

function InventoryRow({ product, onAdjust, onLots, exchangeRate }: { product: ApiProduct; onAdjust: () => void; onLots: () => void; exchangeRate: number }) {
  const updateStock = useUpdateCostProductStock();
  const status = getStatus(product);
  const { label, icon: Icon, color, bg } = STATUS_CFG[status];
  const portionSize = product.presentation_qty ?? 1;

  return (
    <tr className="group border-b border-slate-50 dark:border-gray-700 hover:bg-slate-50/50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-9 w-9 rounded-lg object-cover border border-slate-100 dark:border-gray-700 shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <Package size={14} className="text-slate-300 dark:text-gray-600" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-800 dark:text-gray-200">{product.name}</p>
            {product.supplier && <p className="text-xs text-slate-400 dark:text-gray-500">{product.supplier}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(product.category)}`}>
          {categoryLabel(product.category)}
        </span>
      </td>
      <td className="px-4 py-3">
        {product.stock_qty != null ? (
          <div>
            <p className="font-semibold text-slate-800 dark:text-gray-200 tabular-nums">{stockLabel(product)}</p>
            {product.portion_qty && <p className="text-xs text-slate-400 dark:text-gray-500">{usosLabel(product)}</p>}
          </div>
        ) : (
          <span className="text-xs text-slate-300 dark:text-gray-600">No configurado</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400 dark:text-gray-500 tabular-nums">
        {product.min_stock_qty != null ? `${fmt(product.min_stock_qty)} ${product.presentation_unit ?? "usos"}` : <span className="text-slate-200 dark:text-gray-700">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${color}`}>
          <Icon size={11} /> {label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-medium text-slate-700 dark:text-gray-300 tabular-nums text-sm">{fmtC(product.unit_price)}</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 tabular-nums">{fmtUSD(product.unit_price, exchangeRate)}</p>
      </td>
      <td className="pr-4 py-3">
        <div className="flex items-center gap-1">
          {product.presentation_qty && (
            <>
              <button onClick={() => updateStock.mutate({ id: product.id, qty: portionSize, operation: "add" })}
                title={`+1 (${fmt(portionSize)} ${product.presentation_unit ?? "u"})`}
                className="rounded p-1.5 text-slate-300 dark:text-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400">
                <Plus size={13} />
              </button>
              <button onClick={() => updateStock.mutate({ id: product.id, qty: -portionSize, operation: "add" })}
                title="-1"
                className="rounded p-1.5 text-slate-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400">
                <Minus size={13} />
              </button>
            </>
          )}
          <button onClick={onAdjust} title="Ajustar stock"
            className="rounded p-1.5 text-slate-300 dark:text-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 dark:hover:text-blue-400">
            <Edit2 size={13} />
          </button>
          <button onClick={onLots} title="Historial de lotes"
            className="rounded p-1.5 text-slate-300 dark:text-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-500 dark:hover:text-purple-400">
            <History size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

function ImportProductsModal({ onClose }: { onClose: () => void }) {
  const importMutation = useImportCostProducts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const csv = "Nombre,Categoría,Proveedor,Costo total (C$),Cantidad presentación,Unidad,Cantidad por porción,Precio por uso (C$),Notas\nAnestesia lidocaína,anestesia,Proveedor X,500,50,ml,2,10,\nGuantes de látex,desechable,,250,100,unidades,1,2.5,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla_productos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    const res = await importMutation.mutateAsync(file);
    setResult(res);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Importar productos desde CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!result ? (
            <>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-semibold">Cómo preparar tu Excel:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>Guarda como <strong>CSV UTF-8</strong> desde Archivo → Guardar como</li>
                  <li>Columnas: <em>Nombre, Categoría, Proveedor, Costo total, Cantidad presentación, Unidad, Cantidad por porción, Notas</em></li>
                  <li>Solo <strong>Nombre</strong> es obligatorio — el resto lo completas luego</li>
                </ol>
              </div>

              <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                <Download size={14} /> Descargar plantilla de ejemplo
              </button>

              <div
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-600 py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <Upload size={24} className="text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {file ? <span className="font-medium text-blue-600">{file.name}</span> : "Haz clic para seleccionar tu archivo CSV"}
                </p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 px-4 py-3">
                <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    {result.created} producto{result.created !== 1 ? "s" : ""} agregado{result.created !== 1 ? "s" : ""}
                  </p>
                  {result.skipped > 0 && <p className="text-xs text-green-700 dark:text-green-400">{result.skipped} filas vacías omitidas</p>}
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Abre cada uno para completar precios y porciones.</p>
                </div>
              </div>
              {result.error_details.length > 0 && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">{result.errors} fila{result.errors !== 1 ? "s" : ""} con error</p>
                  </div>
                  {result.error_details.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">Fila {e.row}: {e.name} — {e.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || importMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {importMutation.isPending ? "Importando…" : <><Upload size={14} /> Importar</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function exportProductsToCSV(products: ApiProduct[]) {
  const rows = [
    ["Nombre", "Categoría", "Proveedor", "Costo total (C$)", "Cantidad presentación", "Unidad", "Cantidad por porción", "Precio por uso (C$)", "Notas"],
    ...products.map((p) => {
      const portions = p.presentation_qty && p.portion_qty ? p.presentation_qty / p.portion_qty : null;
      const unitPrice = p.unit_price > 0 ? p.unit_price
        : (p.total_cost && portions ? p.total_cost / portions : null);
      return [
        p.name,
        p.category,
        p.supplier ?? "",
        p.total_cost ?? "",
        p.presentation_qty ?? "",
        p.presentation_unit ?? "",
        p.portion_qty ?? "",
        unitPrice ?? "",
        p.notes ?? "",
      ];
    }),
  ];
  const csv = "﻿" + rows.map((r) =>
    r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "productos.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function ProductosPage() {
  const { data: products = [], isLoading } = useCostProducts();
  const { data: treatments = [] } = useCostTreatments();
  const { data: clinicSettings } = useClinicSettings();
  const exchangeRate = clinicSettings?.usd_exchange_rate ?? 37;
  const createProduct = useCreateCostProduct();
  const updateProduct = useUpdateCostProduct();
  const reorderProducts = useReorderCostProducts();

  const searchParams = useSearchParams();
  const [view, setView] = useState<"catalogo" | "inventario">(
    () => searchParams.get("view") === "inventario" ? "inventario" : "catalogo"
  );
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [adjusting, setAdjusting] = useState<ApiProduct | null>(null);
  const [lotsProduct, setLotsProduct] = useState<ApiProduct | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"bajo" | null>(
    () => searchParams.get("stock") === "bajo" ? "bajo" : null
  );
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [usageProduct, setUsageProduct] = useState<ApiProduct | null>(null);
  const [linksProduct, setLinksProduct] = useState<ApiProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState("");
  const renameCategory = useRenameCostCategory();
  const deleteCategory = useDeleteCostCategory();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);
  const bulkDelete = useDeleteCostProducts();

  const filtered = products.filter((p) => {
    const matchSearch = normalizeSearch(p.name).includes(normalizeSearch(search)) || normalizeSearch(p.supplier ?? "").includes(normalizeSearch(search));
    const matchCat = category === "all" || p.category === category;
    const matchStock = stockFilter !== "bajo" || (
      p.stock_qty != null && (p.stock_qty <= 0 || (p.min_stock_qty != null && p.stock_qty <= p.min_stock_qty))
    );
    return matchSearch && matchCat && matchStock;
  });

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, [search, category]);

  function handleSelect(id: string, index: number, shiftKey: boolean) {
    if (shiftKey && lastSelectedIndexRef.current !== null) {
      const from = Math.min(lastSelectedIndexRef.current, index);
      const to = Math.max(lastSelectedIndexRef.current, index);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) next.add(filtered[i].id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      lastSelectedIndexRef.current = index;
    }
  }

  function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(`¿Eliminar ${ids.length} producto${ids.length !== 1 ? "s" : ""} seleccionado${ids.length !== 1 ? "s" : ""}?`)) return;
    bulkDelete.mutate(ids, { onSuccess: () => setSelectedIds(new Set()) });
  }

  function handleRenameCategory(oldCat: string) {
    const newCat = editCategoryValue.trim();
    if (!newCat || newCat === oldCat) { setEditingCategory(null); return; }
    renameCategory.mutate({ from_category: oldCat, to_category: newCat }, {
      onSuccess: () => {
        if (category === oldCat) setCategory(newCat);
        setEditingCategory(null);
      },
    });
  }

  function handleDeleteCategory(cat: string) {
    const count = products.filter((p) => p.category === cat).length;
    const msg = count > 0
      ? `¿Eliminar la categoría "${categoryLabel(cat)}"? Los ${count} producto${count !== 1 ? "s" : ""} se moverán a "Otros".`
      : `¿Eliminar la categoría "${categoryLabel(cat)}"?`;
    if (!confirm(msg)) return;
    deleteCategory.mutate({ category: cat }, {
      onSuccess: () => { if (category === cat) setCategory("all"); },
    });
  }

  const hasFilter = search.trim() !== "" || category !== "all" || stockFilter !== null;
  const isDragDisabled = search.trim() !== "" || stockFilter !== null;

  const allCategoriesInUse: string[] = [
    ...ALL_CATEGORIES.filter((c) => products.some((p) => p.category === c)),
    ...products.map((p) => p.category).filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const stockCounts = useMemo(() => {
    const c = { ok: 0, low: 0, empty: 0, unconfigured: 0 };
    for (const p of products) c[getStatus(p)]++;
    return c;
  }, [products]);

  const linkedCount = useMemo(() => treatments.filter((t) => t.procedure_catalog_id).length, [treatments]);

  const inventoryFiltered = useMemo(
    () => filtered.filter((p) => statusFilter === "all" || getStatus(p) === statusFilter),
    [filtered, statusFilter]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((p) => p.id === active.id);
    const newIndex = filtered.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newFiltered = arrayMove(filtered, oldIndex, newIndex);
    // Rebuild full list: filtered items take their new positions, rest stay put
    const newProducts = [...products];
    const filteredPositions = products.reduce<number[]>((acc, p, i) => {
      if (filtered.some((f) => f.id === p.id)) acc.push(i);
      return acc;
    }, []);
    filteredPositions.forEach((pos, i) => { newProducts[pos] = newFiltered[i]; });
    reorderProducts.mutate(newProducts.map((p) => p.id));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 dark:text-gray-500">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/costos" className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 mt-0.5"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Productos</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
              {view === "catalogo" ? "Precios y detalles de materiales" : "Control de stock y lotes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {view === "catalogo" && (
            <>
              <Button variant="secondary" size="sm" onClick={() => exportProductsToCSV(products)} disabled={products.length === 0}><Download size={15} /> Exportar</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}><Upload size={15} /> Importar</Button>
            </>
          )}
          <Button size="sm" onClick={() => setShowNew(true)}><Plus size={15} /> Nuevo producto</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-1 w-fit">
        <button
          onClick={() => setView("catalogo")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${view === "catalogo" ? "bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
        >
          <Package size={14} /> Catálogo
        </button>
        <button
          onClick={() => { setView("inventario"); setStatusFilter("all"); }}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${view === "inventario" ? "bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
        >
          <Layers size={14} /> Inventario
          {(stockCounts.low > 0 || stockCounts.empty > 0) && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center">
              {stockCounts.low + stockCounts.empty}
            </span>
          )}
        </button>
      </div>

      {/* KPI cards — solo en inventario */}
      {view === "inventario" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["ok", "low", "empty", "unconfigured"] as StockStatus[]).map((s) => {
              const { label, icon: Icon, color, bg } = STATUS_CFG[s];
              return (
                <button key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                  className={`rounded-xl border p-4 text-left transition-all ${statusFilter === s ? "border-blue-300 dark:border-blue-700 ring-2 ring-blue-200 dark:ring-blue-800" : "border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"} bg-white dark:bg-gray-800`}
                >
                  <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
                    <Icon size={11} /> {label}
                  </div>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{stockCounts[s]}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">producto{stockCounts[s] !== 1 ? "s" : ""}</p>
                </button>
              );
            })}
          </div>
          {linkedCount === 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <Link2 size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-400">
                <span className="font-semibold">El descuento automático no está configurado.</span>{" "}
                Ve a <Link href="/settings" className="underline font-medium">Configuración → Catálogo</Link> y vincula cada procedimiento a su tratamiento de Costos.
              </p>
            </div>
          )}
        </>
      )}

      <div className="mb-4 flex flex-col gap-3">
        {view === "catalogo" && stockFilter === "bajo" && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-3 py-2">
            <AlertTriangle size={13} className="text-orange-500 shrink-0" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-300 flex-1">
              Mostrando solo materiales agotados o con stock bajo ({filtered.length})
            </span>
            <button onClick={() => setStockFilter(null)} className="text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors" title="Quitar filtro">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input type="text" placeholder="Buscar producto o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setCategory("all")} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"}`}>
            Todos <span className={`ml-1 tabular-nums ${category === "all" ? "opacity-80" : "opacity-60"}`}>({view === "inventario" ? inventoryFiltered.length : products.length})</span>
          </button>
          {allCategoriesInUse.map((cat) => {
            const count = (view === "inventario" ? inventoryFiltered : products).filter((p) => p.category === cat).length;
            if (view === "catalogo" && editingCategory === cat) {
              return (
                <div key={cat} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editCategoryValue}
                    onChange={(e) => setEditCategoryValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameCategory(cat);
                      if (e.key === "Escape") setEditingCategory(null);
                    }}
                    className="h-8 w-32 rounded-lg border border-blue-400 ring-2 ring-blue-100 dark:ring-blue-800 px-2 text-xs focus:outline-none dark:bg-gray-700 dark:text-white dark:border-blue-500"
                  />
                  <button onClick={() => handleRenameCategory(cat)} title="Guardar" className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setEditingCategory(null)} title="Cancelar" className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700">
                    <X size={13} />
                  </button>
                </div>
              );
            }

            return (
              <div key={cat} className="group/chip flex items-center gap-0.5">
                <button onClick={() => setCategory(cat)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === cat ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"}`}>
                  {categoryLabel(cat)} <span className={`ml-1 tabular-nums ${category === cat ? "opacity-80" : "opacity-60"}`}>({count})</span>
                </button>
                {view === "catalogo" && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCategory(cat); setEditCategoryValue(cat); }} title="Renombrar categoría"
                      className="rounded p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Edit2 size={11} /></button>
                    <button onClick={() => handleDeleteCategory(cat)} title="Eliminar categoría"
                      className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk delete bar — catálogo only */}
      {view === "catalogo" && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} producto{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleBulkDelete} disabled={bulkDelete.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50">
              <Trash2 size={13} /> Eliminar seleccionados
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Vista Catálogo ── */}
      {view === "catalogo" && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Package size={32} className="text-slate-300 dark:text-gray-600" />
              <p className="text-slate-500 dark:text-gray-400 font-medium">Sin productos</p>
              <p className="text-sm text-slate-400 dark:text-gray-500">Prueba con otro filtro o agrega un producto nuevo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                    <th className="w-10 pl-3">
                      <input type="checkbox" checked={allSelected}
                        onChange={(e) => setSelectedIds(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        className="rounded border-slate-300 dark:border-gray-600 cursor-pointer accent-blue-600" />
                    </th>
                    <th className="w-7 pl-2" />
                    <th className="pr-2 py-3 text-right font-medium w-8">#</th>
                    <th className="px-3 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">Categoría</th>
                    <th className="px-4 py-3 text-left font-medium">Presentación / uso</th>
                    <th className="px-4 py-3 text-right font-medium">Costo total</th>
                    <th className="px-5 py-3 text-right font-medium">C$/uso</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                    <th className="px-4 py-3 text-left font-medium">Mínimo</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="w-28 py-3" />
                  </tr>
                </thead>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filtered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {filtered.map((p, i) => (
                        <SortableProductRow key={p.id} product={p} onEdit={() => setEditingProduct(p)} onViewUsage={() => setUsageProduct(p)} onViewLinks={() => setLinksProduct(p)} onAdjust={() => setAdjusting(p)} onLots={() => setLotsProduct(p)} isDragDisabled={isDragDisabled} exchangeRate={exchangeRate} rowNumber={i + 1} isSelected={selectedIds.has(p.id)} onSelect={(shiftKey) => handleSelect(p.id, i, shiftKey)} />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Vista Inventario ── */}
      {view === "inventario" && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {inventoryFiltered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Package size={32} className="text-slate-300 dark:text-gray-600" />
              <p className="text-slate-500 dark:text-gray-400 font-medium">Sin productos</p>
              <p className="text-sm text-slate-400 dark:text-gray-500">Prueba con otro filtro o estado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-3 py-3 text-left font-medium">Categoría</th>
                    <th className="px-4 py-3 text-left font-medium">Stock actual</th>
                    <th className="px-4 py-3 text-left font-medium">Mínimo</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">C$/uso</th>
                    <th className="w-28 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {inventoryFiltered.map((p) => (
                    <InventoryRow key={p.id} product={p} onAdjust={() => setAdjusting(p)} onLots={() => setLotsProduct(p)} exchangeRate={exchangeRate} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400 dark:text-gray-500 text-center">
        {view === "catalogo"
          ? `${filtered.length} producto${filtered.length !== 1 ? "s" : ""}${isDragDisabled ? " · Limpia la búsqueda para reordenar" : " · Arrastra para reordenar · Pasa el mouse para editar"}`
          : `${inventoryFiltered.length} de ${products.length} producto${products.length !== 1 ? "s" : ""} · ${linkedCount} tratamiento${linkedCount !== 1 ? "s" : ""} vinculado${linkedCount !== 1 ? "s" : ""} para descuento automático`
        }
      </p>

      {/* Modales */}
      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />}
      {lotsProduct && <LotHistoryModal product={lotsProduct} onClose={() => setLotsProduct(null)} />}
      {showImport && <ImportProductsModal onClose={() => setShowImport(false)} />}
      {showNew && (
        <ProductModal
          extraCategories={allCategoriesInUse}
          onSave={(data) => createProduct.mutate(data)}
          onClose={() => setShowNew(false)}
          onManageCategories={() => setShowManageCategories(true)}
        />
      )}
      {editingProduct && (
        <ProductModal
          initial={editingProduct}
          extraCategories={allCategoriesInUse}
          onSave={(data) => updateProduct.mutate({ id: editingProduct.id, ...data })}
          onClose={() => setEditingProduct(null)}
          onManageCategories={() => setShowManageCategories(true)}
        />
      )}
      {showManageCategories && (
        <ManageCategoriesModal
          categories={allCategoriesInUse}
          onClose={() => setShowManageCategories(false)}
        />
      )}
      {usageProduct && (
        <ProductUsageModal product={usageProduct} onClose={() => setUsageProduct(null)} />
      )}
      {linksProduct && (
        <ProductLinksModal product={linksProduct} onClose={() => setLinksProduct(null)} />
      )}
    </div>
  );
}
