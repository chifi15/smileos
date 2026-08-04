"use client";

import { useState } from "react";
import { Package, Plus, Minus, Edit2, AlertTriangle, CheckCircle, XCircle, Search, Link2 } from "lucide-react";
import Link from "next/link";
import { useCostosStore } from "@/stores/costos.store";
import { Product, PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_COLORS, ProductCategory } from "@/types/costos";
import { fmt } from "@/lib/costos-utils";

const ALL_CATEGORIES: ProductCategory[] = [
  "desechable", "anestesia", "endodoncia", "restauracion", "profilaxis", "instrumental", "otros",
];

// ─── Estado del stock ─────────────────────────────────────────────────────────

type StockStatus = "ok" | "low" | "empty" | "unconfigured";

function getStatus(p: Product): StockStatus {
  if (p.stockQty == null) return "unconfigured";
  if (p.stockQty <= 0) return "empty";
  if (p.minStockQty != null && p.stockQty <= p.minStockQty) return "low";
  return "ok";
}

const STATUS_CONFIG: Record<StockStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ok:           { label: "OK",          icon: CheckCircle,   color: "text-green-600",  bg: "bg-green-50" },
  low:          { label: "Alerta",      icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50" },
  empty:        { label: "Agotado",     icon: XCircle,       color: "text-red-600",    bg: "bg-red-50" },
  unconfigured: { label: "Sin stock",   icon: Package,       color: "text-slate-400",  bg: "bg-slate-50" },
};

function stockLabel(p: Product): string {
  if (p.stockQty == null) return "—";
  const unit = p.presentationUnit ?? "usos";
  return `${fmt(p.stockQty)} ${unit}`;
}

function usosLabel(p: Product): string {
  if (p.stockQty == null) return "—";
  if (!p.portionQty) return `${fmt(p.stockQty)} usos`;
  return `≈ ${fmt(p.stockQty / p.portionQty)} usos`;
}

// ─── Modal ajuste de stock ────────────────────────────────────────────────────

function AdjustModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const addStock = useCostosStore((s) => s.addStock);
  const setStock = useCostosStore((s) => s.setStock);
  const setMinStock = useCostosStore((s) => s.setMinStock);

  const unit = product.presentationUnit ?? "unidades";
  const portionUnit = product.presentationUnit ?? "uso";

  // Para "recibir": cuántos frascos/paquetes completos llegaron
  const [recibirQty, setRecibirQty] = useState("");
  // Para "ajuste manual": valor absoluto
  const [ajusteQty, setAjusteQty] = useState(product.stockQty != null ? String(product.stockQty) : "");
  // Mínimo
  const [minQty, setMinQty] = useState(product.minStockQty != null ? String(product.minStockQty) : "");

  const portionSize = product.portionQty ?? 1;
  const presentationSize = product.presentationQty ?? 1;

  function handleRecibir() {
    const n = parseFloat(recibirQty);
    if (!n || n <= 0) return;
    // Cada "frasco" = presentationQty unidades
    addStock(product.id, n * presentationSize);
    onClose();
  }

  function handleAjustar() {
    const n = parseFloat(ajusteQty);
    if (isNaN(n) || n < 0) return;
    setStock(product.id, n);
    const min = parseFloat(minQty);
    setMinStock(product.id, isNaN(min) || minQty === "" ? undefined : min);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Ajustar stock — {product.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Stock actual: <strong>{stockLabel(product)}</strong>
            {product.portionQty && <> · {usosLabel(product)}</>}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Recibir stock nuevo */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">Recibir mercancía nueva</p>
            {product.presentationQty ? (
              <p className="text-xs text-slate-500">
                Cada unidad = {fmt(presentationSize)} {unit}
                {product.portionQty && <> · {fmt(presentationSize / portionSize)} usos</>}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={recibirQty}
                onChange={(e) => setRecibirQty(e.target.value)}
                placeholder={product.presentationQty ? "ej. 2 frascos" : `ej. 500 ${unit}`}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400 whitespace-nowrap">
                {product.presentationQty ? "frascos/unidades" : unit}
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

          {/* Ajuste manual */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Ajuste manual (conteo físico)</p>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stock actual en {unit}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={ajusteQty}
                onChange={(e) => setAjusteQty(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stock mínimo para alerta (en {unit})</label>
              <input
                type="number"
                min="0"
                step="any"
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
          <button onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de producto en inventario ──────────────────────────────────────────

function InventoryRow({ product, onAdjust }: { product: Product; onAdjust: () => void }) {
  const addStock = useCostosStore((s) => s.addStock);
  const status = getStatus(product);
  const { label, icon: Icon, color, bg } = STATUS_CONFIG[status];
  const portionSize = product.presentationQty ?? 1;

  return (
    <tr className="group border-b border-slate-50 hover:bg-slate-50/50">
      {/* Producto */}
      <td className="px-5 py-3">
        <p className="font-medium text-slate-800">{product.name}</p>
        {product.supplier && <p className="text-xs text-slate-400">{product.supplier}</p>}
      </td>

      {/* Categoría */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRODUCT_CATEGORY_COLORS[product.category]}`}>
          {PRODUCT_CATEGORY_LABELS[product.category]}
        </span>
      </td>

      {/* Stock actual */}
      <td className="px-4 py-3">
        {product.stockQty != null ? (
          <div>
            <p className="font-semibold text-slate-800 tabular-nums">{stockLabel(product)}</p>
            {product.portionQty && (
              <p className="text-xs text-slate-400">{usosLabel(product)}</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300">No configurado</span>
        )}
      </td>

      {/* Mínimo */}
      <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">
        {product.minStockQty != null
          ? `${fmt(product.minStockQty)} ${product.presentationUnit ?? "usos"}`
          : <span className="text-slate-200">—</span>}
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${color}`}>
          <Icon size={11} />
          {label}
        </span>
      </td>

      {/* Acciones rápidas */}
      <td className="pr-4 py-3">
        <div className="flex items-center gap-1">
          {product.presentationQty && (
            <>
              <button
                onClick={() => addStock(product.id, portionSize)}
                title={`+1 frasco (${fmt(portionSize)} ${product.presentationUnit ?? "u"})`}
                className="rounded p-1.5 text-slate-300 hover:bg-green-50 hover:text-green-600"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => addStock(product.id, -portionSize)}
                title={`-1 frasco`}
                className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
              >
                <Minus size={13} />
              </button>
            </>
          )}
          <button
            onClick={onAdjust}
            title="Ajustar stock"
            className="rounded p-1.5 text-slate-300 hover:bg-blue-50 hover:text-blue-500"
          >
            <Edit2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function InventarioPage() {
  const products = useCostosStore((s) => s.products);
  const treatments = useCostosStore((s) => s.treatments);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    const matchStatus = statusFilter === "all" || getStatus(p) === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  // Contadores para el resumen
  const counts = { ok: 0, low: 0, empty: 0, unconfigured: 0 };
  for (const p of products) counts[getStatus(p)]++;

  // Cuántos procedimientos están vinculados
  const linkedCount = treatments.filter((t) => t.procedureCatalogId).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stock de materiales · se descuenta automáticamente al registrar procedimientos en Finanzas
          </p>
        </div>
        <Link
          href="/costos/productos"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Package size={14} />
          Editar productos
        </Link>
      </div>

      {/* Resumen */}
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

      {/* Banner vinculación */}
      {linkedCount === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Link2 size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">El descuento automático no está configurado.</span>{" "}
            Ve a{" "}
            <Link href="/settings" className="underline font-medium">Configuración → Catálogo de Procedimientos</Link>
            {" "}y vincula cada procedimiento con su tratamiento de Costos Operativos.
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Todos
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${category === cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {PRODUCT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
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

      {adjusting && (
        <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />
      )}
    </div>
  );
}
