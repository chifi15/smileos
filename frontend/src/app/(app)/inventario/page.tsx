"use client";

import { useState } from "react";
import { Package, Plus, Minus, Edit2, AlertTriangle, CheckCircle, XCircle, Search, Link2, History, X } from "lucide-react";
import Link from "next/link";
import {
  useCostProducts,
  useCostTreatments,
  useUpdateCostProductStock,
  useUpdateCostProductMinStock,
  useProductLots,
  useOpenProductLot,
  useFinishProductLot,
  useDeleteProductLot,
  ApiProduct,
  ApiProductLot,
} from "@/hooks/useCostos";
import { categoryLabel, categoryColor, ProductCategory } from "@/types/costos";
import { fmt, fmtC, fmtUSD } from "@/lib/costos-utils";
import { useClinicSettings } from "@/hooks/useSettings";

const ALL_CATEGORIES: ProductCategory[] = [
  "desechable", "anestesia", "endodoncia", "restauracion", "profilaxis", "instrumental", "otros",
];

type StockStatus = "ok" | "low" | "empty" | "unconfigured";

function getStatus(p: ApiProduct): StockStatus {
  if (p.stock_qty == null) return "unconfigured";
  if (p.stock_qty <= 0) return "empty";
  if (p.min_stock_qty != null && p.stock_qty <= p.min_stock_qty) return "low";
  return "ok";
}

const STATUS_CONFIG: Record<StockStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ok:           { label: "OK",       icon: CheckCircle,   color: "text-green-600", bg: "bg-green-50" },
  low:          { label: "Alerta",   icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  empty:        { label: "Agotado",  icon: XCircle,       color: "text-red-600",   bg: "bg-red-50" },
  unconfigured: { label: "Sin stock",icon: Package,       color: "text-slate-400", bg: "bg-slate-50" },
};

function stockLabel(p: ApiProduct): string {
  if (p.stock_qty == null) return "—";
  return `${fmt(p.stock_qty)} ${p.presentation_unit ?? "usos"}`;
}

function usosLabel(p: ApiProduct): string {
  if (p.stock_qty == null) return "—";
  if (!p.portion_qty) return `${fmt(p.stock_qty)} usos`;
  return `≈ ${fmt(p.stock_qty / p.portion_qty)} usos`;
}

// ─── Modal ajuste de stock ────────────────────────────────────────────────────

function AdjustModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  const updateStock = useUpdateCostProductStock();
  const updateMinStock = useUpdateCostProductMinStock();

  const unit = product.presentation_unit ?? "unidades";
  const portionSize = product.portion_qty ?? 1;
  const presentationSize = product.presentation_qty ?? 1;

  const [recibirQty, setRecibirQty] = useState("");
  const [ajusteQty, setAjusteQty] = useState(product.stock_qty != null ? String(product.stock_qty) : "");
  const [minQty, setMinQty] = useState(product.min_stock_qty != null ? String(product.min_stock_qty) : "");

  function handleRecibir() {
    const n = parseFloat(recibirQty);
    if (!n || n <= 0) return;
    updateStock.mutate({ id: product.id, qty: n * presentationSize, operation: "add" });
    onClose();
  }

  function handleAjustar() {
    const n = parseFloat(ajusteQty);
    if (isNaN(n) || n < 0) return;
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
              <input
                type="number" min="0" step="1"
                value={recibirQty}
                onChange={(e) => setRecibirQty(e.target.value)}
                placeholder={product.presentation_qty ? "ej. 2 frascos" : `ej. 500 ${unit}`}
                className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400 dark:text-gray-500 whitespace-nowrap">
                {product.presentation_qty ? "frascos/unidades" : unit}
              </span>
            </div>
            {recibirQty && parseFloat(recibirQty) > 0 && (
              <p className="text-xs text-green-700">
                + {fmt(parseFloat(recibirQty) * presentationSize)} {unit} al stock
              </p>
            )}
            <button
              onClick={handleRecibir}
              disabled={!recibirQty || parseFloat(recibirQty) <= 0}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} className="inline mr-1" />
              Agregar al stock
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Ajuste manual (conteo físico)</p>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Stock actual en {unit}</label>
              <input
                type="number" min="0" step="any"
                value={ajusteQty}
                onChange={(e) => setAjusteQty(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Stock mínimo para alerta (en {unit})</label>
              <input
                type="number" min="0" step="any"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAjustar}
              className="w-full rounded-lg border border-slate-300 dark:border-gray-600 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
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

// ─── Modal historial de lotes ──────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString("es-NI", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function LotHistoryModal({ product, onClose }: { product: ApiProduct; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: lots = [], isLoading } = useProductLots(product.id);
  const openLot = useOpenProductLot();
  const finishLot = useFinishProductLot();
  const deleteLot = useDeleteProductLot();

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openedAt, setOpenedAt] = useState(today);
  const [expectedPortions, setExpectedPortions] = useState("");
  const [notes, setNotes] = useState("");
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState(today);

  const activeLot = lots.find((l) => !l.finished_at);
  const pastLots = lots.filter((l) => l.finished_at);

  function handleOpenLot() {
    openLot.mutate({
      productId: product.id,
      opened_at: openedAt,
      expected_portions: expectedPortions ? parseFloat(expectedPortions) : null,
      notes: notes || null,
    });
    setShowOpenForm(false);
    setExpectedPortions("");
    setNotes("");
    setOpenedAt(today);
  }

  function handleFinish(lot: ApiProductLot) {
    finishLot.mutate({ productId: product.id, lotId: lot.id, finished_at: finishedAt });
    setFinishingId(null);
  }

  function efficiency(lot: ApiProductLot): string | null {
    if (!lot.expected_portions || !lot.finished_at) return null;
    const pct = ((lot.used_portions - lot.expected_portions) / lot.expected_portions) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(0) + "% vs esperado";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] flex flex-col">
        <div className="border-b border-slate-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Historial de lotes</h2>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Active lot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Lote activo</p>
              {!activeLot && !showOpenForm && (
                <button
                  onClick={() => setShowOpenForm(true)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus size={12} /> Abrir nuevo lote
                </button>
              )}
            </div>

            {isLoading ? (
              <p className="text-xs text-slate-400 dark:text-gray-500">Cargando...</p>
            ) : activeLot ? (
              <div className="rounded-xl border border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-gray-200">
                      Abierto el {formatDate(activeLot.opened_at)}
                    </p>
                    {activeLot.notes && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{activeLot.notes}</p>}
                  </div>
                  <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">En uso</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-gray-400">
                    <span>Porciones usadas: <strong>{activeLot.used_portions.toFixed(1)}</strong></span>
                    {activeLot.expected_portions && (
                      <span>Esperadas: <strong>{activeLot.expected_portions}</strong></span>
                    )}
                  </div>
                  {activeLot.expected_portions && (
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${Math.min(100, (activeLot.used_portions / activeLot.expected_portions) * 100).toFixed(0)}%` }}
                      />
                    </div>
                  )}
                </div>

                {finishingId === activeLot.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleFinish(activeLot)}
                      className="rounded-lg bg-slate-700 dark:bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-gray-500"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setFinishingId(null)} className="text-xs text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setFinishingId(activeLot.id)}
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                  >
                    Marcar como agotado
                  </button>
                )}
              </div>
            ) : !showOpenForm ? (
              <p className="text-xs text-slate-400 dark:text-gray-500 italic">No hay lote activo. Abre uno para comenzar a rastrear el rendimiento.</p>
            ) : null}

            {/* Open lot form */}
            {showOpenForm && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Abrir nuevo lote</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Fecha de apertura</label>
                    <input
                      type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Porciones esperadas</label>
                    <input
                      type="number" min="0" step="any"
                      value={expectedPortions} onChange={(e) => setExpectedPortions(e.target.value)}
                      placeholder="Ej. 100"
                      className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Notas (opcional)</label>
                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Marca X, lote 2024-01"
                    className="w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenLot}
                    disabled={openLot.isPending}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    Abrir lote
                  </button>
                  <button onClick={() => setShowOpenForm(false)} className="rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Past lots */}
          {pastLots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-2">Historial</p>
              <div className="space-y-2">
                {pastLots.map((lot) => {
                  const eff = efficiency(lot);
                  return (
                    <div key={lot.id} className="rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-gray-300">
                            {formatDate(lot.opened_at)} → {lot.finished_at ? formatDate(lot.finished_at) : "—"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            {lot.used_portions.toFixed(1)} porciones usadas
                            {lot.expected_portions && <> · esperadas: {lot.expected_portions}</>}
                          </p>
                          {eff && (
                            <p className={`text-xs font-medium mt-0.5 ${eff.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                              {eff}
                            </p>
                          )}
                          {lot.notes && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">{lot.notes}</p>}
                        </div>
                        <button
                          onClick={() => deleteLot.mutate({ productId: product.id, lotId: lot.id })}
                          className="shrink-0 rounded p-1 text-slate-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Eliminar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && lots.length === 0 && !showOpenForm && (
            <p className="text-center text-xs text-slate-400 dark:text-gray-500 py-4">
              Sin historial. Abre el primer lote para comenzar a rastrear el rendimiento del producto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fila de inventario ───────────────────────────────────────────────────────

function InventoryRow({ product, onAdjust, onLots, exchangeRate }: { product: ApiProduct; onAdjust: () => void; onLots: () => void; exchangeRate: number }) {
  const updateStock = useUpdateCostProductStock();
  const status = getStatus(product);
  const { label, icon: Icon, color, bg } = STATUS_CONFIG[status];
  const portionSize = product.presentation_qty ?? 1;

  return (
    <tr className="group border-b border-slate-50 dark:border-gray-700 hover:bg-slate-50/50 dark:hover:bg-gray-700/50">
      <td className="px-5 py-3">
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
            {product.purchase_date && (
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Comprado: {new Date(product.purchase_date + "T00:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
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
        {product.min_stock_qty != null
          ? `${fmt(product.min_stock_qty)} ${product.presentation_unit ?? "usos"}`
          : <span className="text-slate-200">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${color}`}>
          <Icon size={11} />
          {label}
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
              <button
                onClick={() => updateStock.mutate({ id: product.id, qty: portionSize, operation: "add" })}
                title={`+1 frasco (${fmt(portionSize)} ${product.presentation_unit ?? "u"})`}
                className="rounded p-1.5 text-slate-300 hover:bg-green-50 hover:text-green-600"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => updateStock.mutate({ id: product.id, qty: -portionSize, operation: "add" })}
                title="-1 frasco"
                className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
              >
                <Minus size={13} />
              </button>
            </>
          )}
          <button onClick={onAdjust} title="Ajustar stock" className="rounded p-1.5 text-slate-300 hover:bg-blue-50 hover:text-blue-500">
            <Edit2 size={13} />
          </button>
          <button onClick={onLots} title="Historial de lotes" className="rounded p-1.5 text-slate-300 hover:bg-purple-50 hover:text-purple-500">
            <History size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const { data: products = [], isLoading } = useCostProducts();
  const { data: treatments = [] } = useCostTreatments();
  const { data: clinicSettings } = useClinicSettings();
  const exchangeRate = clinicSettings?.usd_exchange_rate ?? 37;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [adjusting, setAdjusting] = useState<ApiProduct | null>(null);
  const [lotsProduct, setLotsProduct] = useState<ApiProduct | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    const matchStatus = statusFilter === "all" || getStatus(p) === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const counts = { ok: 0, low: 0, empty: 0, unconfigured: 0 };
  for (const p of products) counts[getStatus(p)]++;

  const allCategoriesInUse: string[] = [
    ...ALL_CATEGORIES,
    ...products.map((p) => p.category).filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const linkedCount = treatments.filter((t) => t.procedure_catalog_id).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 dark:text-gray-500">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Inventario</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Stock de materiales · se descuenta automáticamente al registrar procedimientos en Finanzas
          </p>
        </div>
        <Link href="/costos/productos" className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 text-sm text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700">
          <Package size={14} />
          Editar productos
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["ok", "low", "empty", "unconfigured"] as StockStatus[]).map((s) => {
          const { label, icon: Icon, color, bg } = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-xl border p-4 text-left transition-all ${statusFilter === s ? "border-blue-300 ring-2 ring-blue-200 dark:ring-blue-700" : "border-slate-200 dark:border-gray-700 hover:border-slate-300"} bg-white dark:bg-gray-800`}
            >
              <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
                <Icon size={11} /> {label}
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{counts[s]}</p>
              <p className="text-xs text-slate-400 dark:text-gray-500">producto{counts[s] !== 1 ? "s" : ""}</p>
            </button>
          );
        })}
      </div>

      {linkedCount === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <Link2 size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-semibold">El descuento automático no está configurado.</span>{" "}
            Ve a{" "}<Link href="/settings" className="underline font-medium">Configuración → Catálogo de Procedimientos</Link>{" "}y vincula cada procedimiento con su tratamiento de Costos Operativos.
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory("all")} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"}`}>Todos</button>
          {allCategoriesInUse.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === cat ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"}`}>
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Package size={32} className="text-slate-300 dark:text-gray-600" />
            <p className="text-slate-500 dark:text-gray-400 font-medium">Sin productos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                <th className="px-5 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Categoría</th>
                <th className="px-4 py-3 text-left font-medium">Stock actual</th>
                <th className="px-4 py-3 text-left font-medium">Mínimo</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">C$/uso</th>
                <th className="w-24 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <InventoryRow key={p.id} product={p} onAdjust={() => setAdjusting(p)} onLots={() => setLotsProduct(p)} exchangeRate={exchangeRate} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-gray-500 text-center">
        {linkedCount} tratamiento{linkedCount !== 1 ? "s" : ""} vinculado{linkedCount !== 1 ? "s" : ""} para descuento automático
        · <Link href="/settings" className="underline hover:text-slate-600">Configurar vínculos</Link>
      </p>

      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />}
      {lotsProduct && <LotHistoryModal product={lotsProduct} onClose={() => setLotsProduct(null)} />}
    </div>
  );
}
