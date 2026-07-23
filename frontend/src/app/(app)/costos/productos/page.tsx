"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Search, Check, X, Edit2, Package } from "lucide-react";
import Link from "next/link";
import { useCostosStore } from "@/stores/costos.store";
import {
  ProductCategory,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_COLORS,
} from "@/types/costos";
import { fmtC } from "@/lib/costos-utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const ALL_CATEGORIES: ProductCategory[] = [
  "desechable",
  "anestesia",
  "endodoncia",
  "restauracion",
  "profilaxis",
  "instrumental",
  "otros",
];

// ─── Inline price editor ──────────────────────────────────────────────────────

function PriceCell({ productId, price }: { productId: string; price: number }) {
  const updateProduct = useCostosStore((s) => s.updateProduct);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function save() {
    const n = parseFloat(value);
    if (!isNaN(n) && n >= 0) updateProduct(productId, { unitPrice: n });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-xs text-slate-400">C$</span>
        <input
          type="number"
          step="0.01"
          className="w-20 rounded border border-blue-400 px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button onClick={save} className="text-green-600 hover:text-green-700 p-0.5">
          <Check size={13} />
        </button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setValue(String(price)); setEditing(true); }}
      className="group flex items-center justify-end gap-1.5 font-medium text-slate-800 hover:text-blue-600"
    >
      {fmtC(price)}
      <Edit2 size={11} className="text-slate-300 group-hover:text-blue-400" />
    </button>
  );
}

// ─── New Product Modal ────────────────────────────────────────────────────────

function NewProductModal({ onClose }: { onClose: () => void }) {
  const addProduct = useCostosStore((s) => s.addProduct);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("desechable");
  const [unitPrice, setUnitPrice] = useState("");
  const [presentation, setPresentation] = useState("");
  const [portion, setPortion] = useState("");
  const [supplier, setSupplier] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    addProduct({
      name: name.trim(),
      category,
      unitPrice: parseFloat(unitPrice) || 0,
      presentation: presentation.trim() || "",
      portionDescription: portion.trim() || "",
      supplier: supplier.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Nuevo producto</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Input
            label="Nombre del producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Composite Bulk Fill A2"
            autoFocus
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Precio por porción (C$)"
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Proveedor (opcional)"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="ej. INDENT"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Presentación"
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              placeholder="ej. 100 unidades"
            />
            <Input
              label="Tamaño de porción"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder="ej. 1 unidad"
            />
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleAdd} disabled={!name.trim()}>
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const products = useCostosStore((s) => s.products);
  const deleteProduct = useCostosStore((s) => s.deleteProduct);
  const updateProduct = useCostosStore((s) => s.updateProduct);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    return matchSearch && matchCat;
  });

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
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Nuevo producto
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* Table */}
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
                <th className="px-4 py-3 text-left font-medium">Presentación</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-5 py-3 text-right font-medium">Precio/porción</th>
                <th className="w-12 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="group hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {p.portionDescription && (
                      <p className="text-xs text-slate-400">porción: {p.portionDescription}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRODUCT_CATEGORY_COLORS[p.category]}`}
                    >
                      {PRODUCT_CATEGORY_LABELS[p.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.presentation || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.supplier || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <PriceCell productId={p.id} price={p.unitPrice} />
                  </td>
                  <td className="pr-3 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar "${p.name}"?`)) deleteProduct(p.id);
                      }}
                      className="hidden rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        {filtered.length} producto{filtered.length !== 1 ? "s" : ""} · Haz clic en el precio para editarlo
      </p>

      {showModal && <NewProductModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
