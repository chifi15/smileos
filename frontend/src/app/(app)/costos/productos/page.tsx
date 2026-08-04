"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Search, X, Edit2, Package, Calculator, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCostosStore } from "@/stores/costos.store";
import {
  Product,
  ProductCategory,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_COLORS,
  PRESENTATION_UNITS,
} from "@/types/costos";
import { fmtC, fmt } from "@/lib/costos-utils";
import Button from "@/components/ui/Button";

const ALL_CATEGORIES: ProductCategory[] = [
  "desechable", "anestesia", "endodoncia", "restauracion", "profilaxis", "instrumental", "otros",
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function calcPortions(presentationQty?: number, portionQty?: number): number | null {
  if (!presentationQty || !portionQty || portionQty <= 0) return null;
  return presentationQty / portionQty;
}

function calcUnitPrice(totalCost?: number, portions?: number | null): number | null {
  if (!totalCost || !portions || portions <= 0) return null;
  return totalCost / portions;
}

// ─── Modal de edición / creación ──────────────────────────────────────────────

interface ProductFormState {
  name: string;
  category: ProductCategory;
  supplier: string;
  notes: string;
  // Calculadora
  totalCost: string;
  presentationQty: string;
  presentationUnit: string;
  portionQty: string;
  manualUnitPrice: string; // override cuando no hay calculadora completa
}

const EMPTY_FORM: ProductFormState = {
  name: "",
  category: "desechable",
  supplier: "",
  notes: "",
  totalCost: "",
  presentationQty: "",
  presentationUnit: "ml",
  portionQty: "",
  manualUnitPrice: "",
};

function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    category: p.category,
    supplier: p.supplier ?? "",
    notes: p.notes ?? "",
    totalCost: p.totalCost != null ? String(p.totalCost) : "",
    presentationQty: p.presentationQty != null ? String(p.presentationQty) : "",
    presentationUnit: p.presentationUnit ?? "ml",
    portionQty: p.portionQty != null ? String(p.portionQty) : "",
    manualUnitPrice: String(p.unitPrice),
  };
}

function ProductModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Product;
  onSave: (data: Omit<Product, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductFormState>(initial ? productToForm(initial) : EMPTY_FORM);

  const f = (key: keyof ProductFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const pQty = parseFloat(form.presentationQty) || 0;
  const portQty = parseFloat(form.portionQty) || 0;
  const tCost = parseFloat(form.totalCost) || 0;
  const portions = calcPortions(pQty || undefined, portQty || undefined);
  const autoPrice = calcUnitPrice(tCost || undefined, portions);
  const hasCalc = pQty > 0 && portQty > 0 && tCost > 0;
  const effectiveUnitPrice = hasCalc && autoPrice != null
    ? autoPrice
    : (parseFloat(form.manualUnitPrice) || 0);

  function handleSave() {
    if (!form.name.trim()) return;

    const presentation = pQty > 0
      ? `${fmt(pQty)}${form.presentationUnit}`
      : (form.manualUnitPrice ? `C$${form.manualUnitPrice}/unidad` : "");
    const portionDescription = portQty > 0
      ? `${fmt(portQty)}${form.presentationUnit}/uso`
      : "";

    onSave({
      name: form.name.trim(),
      category: form.category,
      supplier: form.supplier.trim() || undefined,
      notes: form.notes.trim() || undefined,
      unitPrice: effectiveUnitPrice,
      presentation,
      portionDescription,
      totalCost: tCost || undefined,
      presentationQty: pQty || undefined,
      presentationUnit: pQty > 0 ? form.presentationUnit : undefined,
      portionQty: portQty || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">{initial ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Datos básicos */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del producto *</label>
              <input
                autoFocus
                value={form.name}
                onChange={f("name")}
                placeholder="ej. Composite Bulk Fill A2"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                <select
                  value={form.category}
                  onChange={f("category")}
                  className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
                <input
                  value={form.supplier}
                  onChange={f("supplier")}
                  placeholder="ej. INDENT"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Calculadora */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Calculadora de costo por uso</span>
            </div>

            {/* Fila presentación */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Presentación total del producto
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.presentationQty}
                  onChange={f("presentationQty")}
                  placeholder="ej. 1000"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={form.presentationUnit}
                  onChange={f("presentationUnit")}
                  className="w-28 h-9 rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRESENTATION_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Ejemplo: 1000 ml, 500 g, 100 unidades</p>
            </div>

            {/* Fila uso por porción */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Cantidad usada por porción / cita
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.portionQty}
                  onChange={f("portionQty")}
                  placeholder="ej. 7"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex h-9 w-28 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-500">
                  {form.presentationUnit}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cuánto se usa en una sola aplicación</p>
            </div>

            {/* Resultado porciones */}
            {portions != null && (
              <div className="flex items-center gap-2 rounded-lg bg-white border border-blue-100 px-4 py-3 text-sm">
                <span className="text-slate-500">
                  {fmt(pQty)}{form.presentationUnit} ÷ {fmt(portQty)}{form.presentationUnit} =
                </span>
                <span className="font-bold text-blue-700 text-base">
                  ≈ {fmt(portions)} usos
                </span>
                <span className="text-slate-400 text-xs ml-1">por frasco/unidad</span>
              </div>
            )}

            {/* Costo total */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Costo del producto completo (C$)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">C$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalCost}
                  onChange={f("totalCost")}
                  placeholder="ej. 350.00"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Resultado costo por uso */}
            {hasCalc && autoPrice != null ? (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-green-700">
                    {fmtC(tCost)} ÷ {fmt(portions!)} usos
                  </div>
                  <ChevronRight size={14} className="text-green-400" />
                  <div className="text-lg font-bold text-green-800">
                    {fmtC(autoPrice)} / uso
                  </div>
                </div>
                <p className="text-[11px] text-green-600 mt-1">Este valor se usará en los cálculos de tratamiento</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Costo por porción / uso (C$) — manual
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">C$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.manualUnitPrice}
                    onChange={f("manualUnitPrice")}
                    placeholder="0.00"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Completa los campos de presentación y costo para calcular automáticamente
                </p>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={f("notes")}
              rows={2}
              placeholder="Observaciones, marca, referencia..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4 sticky bottom-0 bg-white">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!form.name.trim() || (!hasCalc && !form.manualUnitPrice)}
          >
            {initial ? "Guardar cambios" : "Agregar producto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de producto ─────────────────────────────────────────────────────────

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const deleteProduct = useCostosStore((s) => s.deleteProduct);
  const portions = calcPortions(product.presentationQty, product.portionQty);
  const hasCalc = portions != null && product.totalCost != null;

  return (
    <tr className="group hover:bg-slate-50/50 border-b border-slate-50">
      {/* Nombre */}
      <td className="px-5 py-3">
        <p className="font-medium text-slate-800">{product.name}</p>
        {product.supplier && <p className="text-xs text-slate-400">{product.supplier}</p>}
        {product.notes && <p className="text-xs text-slate-300 italic truncate max-w-[180px]">{product.notes}</p>}
      </td>

      {/* Categoría */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRODUCT_CATEGORY_COLORS[product.category]}`}>
          {PRODUCT_CATEGORY_LABELS[product.category]}
        </span>
      </td>

      {/* Presentación → desglose */}
      <td className="px-4 py-3">
        {hasCalc ? (
          <div className="text-xs space-y-0.5">
            <p className="text-slate-600">
              <span className="font-medium">{fmt(product.presentationQty!)}{product.presentationUnit}</span>
              {" "}total · {fmt(product.portionQty!)}{product.presentationUnit}/uso
            </p>
            <p className="text-slate-400">≈ {fmt(portions!)} usos por frasco</p>
          </div>
        ) : product.presentation ? (
          <span className="text-sm text-slate-500">{product.presentation}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Costo total */}
      <td className="px-4 py-3 text-right">
        {product.totalCost != null ? (
          <span className="text-sm text-slate-600 tabular-nums">{fmtC(product.totalCost)}</span>
        ) : (
          <span className="text-slate-300 text-sm">—</span>
        )}
      </td>

      {/* Costo/uso */}
      <td className="px-5 py-3 text-right">
        <div>
          <p className="font-semibold text-slate-800 tabular-nums">{fmtC(product.unitPrice)}</p>
          {hasCalc && (
            <p className="text-[10px] text-green-600">calculado</p>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td className="pr-3 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
            title="Editar"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => { if (confirm(`¿Eliminar "${product.name}"?`)) deleteProduct(product.id); }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const products = useCostosStore((s) => s.products);
  const addProduct = useCostosStore((s) => s.addProduct);
  const updateProduct = useCostosStore((s) => s.updateProduct);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [showNew, setShowNew] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    return matchSearch && matchCat;
  });

  function handleSaveNew(data: Omit<Product, "id">) {
    addProduct(data);
  }

  function handleSaveEdit(data: Omit<Product, "id">) {
    if (!editingProduct) return;
    updateProduct(editingProduct.id, data);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/costos" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Catálogo de Productos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Actualiza precios aquí y se reflejan en todos los tratamientos automáticamente
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={15} /> Nuevo producto
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
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
            <p className="text-sm text-slate-400">Prueba con otro filtro o agrega un producto nuevo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="px-5 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Categoría</th>
                <th className="px-4 py-3 text-left font-medium">Presentación / uso</th>
                <th className="px-4 py-3 text-right font-medium">Costo total</th>
                <th className="px-5 py-3 text-right font-medium">C$/uso</th>
                <th className="w-16 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProductRow key={p.id} product={p} onEdit={() => setEditingProduct(p)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        {filtered.length} producto{filtered.length !== 1 ? "s" : ""} · Pasa el mouse sobre una fila para editar
      </p>

      {showNew && (
        <ProductModal onSave={handleSaveNew} onClose={() => setShowNew(false)} />
      )}
      {editingProduct && (
        <ProductModal
          initial={editingProduct}
          onSave={handleSaveEdit}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}
