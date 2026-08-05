"use client";

import { useState } from "react";
import { Package, Plus, Minus, Edit2, AlertTriangle, CheckCircle, XCircle, Search, Link2 } from "lucide-react";
import Link from "next/link";
import {
  useCostProducts,
  useCostTreatments,
  useUpdateCostProductStock,
  useUpdateCostProductMinStock,
  ApiProduct,
} from "@/hooks/useCostos";
import { PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_COLORS, ProductCategory } from "@/types/costos";
import { fmt } from "@/lib/costos-utils";

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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Ajustar stock — {product.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Stock actual: <strong>{stockLabel(product)}</strong>
            {product.portion_qty && <> · {usosLabel(product)}</>}
          </p>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">Recibir mercancía nueva</p>
            {product.presentation_qty ? (
              <p className="text-xs text-slate-500">
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
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400 whitespace-nowrap">
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
            <p className="text-sm font-semibold text-slate-700">Ajuste manual (conteo físico)</p>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stock actual en {unit}</label>
              <input
                type="number" min="0" step="any"
                value={ajusteQty}
                onChange={(e) => setAjusteQty(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stock mínimo para alerta (en {unit})</label>
              <input
                type="number" min="0" step="any"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAjustar}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Guardar ajuste
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de inventario ───────────────────────────────────────────────────────

function InventoryRow({ product, onAdjust }: { product: ApiProduct; onAdjust: () => void }) {
  const updateStock = useUpdateCostProductStock();
  const status = getStatus(product);
  const { label, icon: Icon, color, bg } = STATUS_CONFIG[status];
  const portionSize = product.presentation_qty ?? 1;

  return (
    <tr className="group border-b border-slate-50 hover:bg-slate-50/50">
      <td className="px-5 py-3">
        <p className="font-medium text-slate-800">{product.name}</p>
        {product.supplier && <p className="text-xs text-slate-400">{product.supplier}</p>}
        {product.purchase_date && (
          <p className="text-xs text-slate-400">
            Comprado: {new Date(product.purchase_date + "T00:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRODUCT_CATEGORY_COLORS[product.category as ProductCategory]}`}>
          {PRODUCT_CATEGORY_LABELS[product.category as ProductCategory]}
        </span>
      </td>
      <td className="px-4 py-3">
        {product.stock_qty != null ? (
          <div>
            <p className="font-semibold text-slate-800 tabular-nums">{stockLabel(product)}</p>
            {product.portion_qty && <p className="text-xs text-slate-400">{usosLabel(product)}</p>}
          </div>
        ) : (
          <span className="text-xs text-slate-300">No configurado</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">
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
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const { data: products = [], isLoading } = useCostProducts();
  const { data: treatments = [] } = useCostTreatments();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [adjusting, setAdjusting] = useState<ApiProduct | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    const matchStatus = statusFilter === "all" || getStatus(p) === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const counts = { ok: 0, low: 0, empty: 0, unconfigured: 0 };
  for (const p of products) counts[getStatus(p)]++;

  const linkedCount = treatments.filter((t) => t.procedure_catalog_id).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stock de materiales · se descuenta automáticamente al registrar procedimientos en Finanzas
          </p>
        </div>
        <Link href="/costos/productos" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
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
              className={`rounded-xl border p-4 text-left transition-all ${statusFilter === s ? "border-blue-300 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300"} bg-white`}
            >
              <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
                <Icon size={11} /> {label}
              </div>
              <p className="text-2xl font-bold text-slate-800">{counts[s]}</p>
              <p className="text-xs text-slate-400">producto{counts[s] !== 1 ? "s" : ""}</p>
            </button>
          );
        })}
      </div>

      {linkedCount === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Link2 size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">El descuento automático no está configurado.</span>{" "}
            Ve a{" "}<Link href="/settings" className="underline font-medium">Configuración → Catálogo de Procedimientos</Link>{" "}y vincula cada procedimiento con su tratamiento de Costos Operativos.
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory("all")} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Todos</button>
          {ALL_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {PRODUCT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Package size={32} className="text-slate-300" />
            <p className="text-slate-500 font-medium">Sin productos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="px-5 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Categoría</th>
                <th className="px-4 py-3 text-left font-medium">Stock actual</th>
                <th className="px-4 py-3 text-left font-medium">Mínimo</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="w-24 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <InventoryRow key={p.id} product={p} onAdjust={() => setAdjusting(p)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        {linkedCount} tratamiento{linkedCount !== 1 ? "s" : ""} vinculado{linkedCount !== 1 ? "s" : ""} para descuento automático
        · <Link href="/settings" className="underline hover:text-slate-600">Configurar vínculos</Link>
      </p>

      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}
