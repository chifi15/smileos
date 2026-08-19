"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Plus, Trash2, Search, X, Edit2, Package, Calculator, ChevronRight, GripVertical, ImagePlus, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCostProducts,
  useCreateCostProduct,
  useUpdateCostProduct,
  useDeleteCostProduct,
  useReorderCostProducts,
  useProductPatientUsage,
  ApiProduct,
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

function ProductModal({ initial, extraCategories, onSave, onClose }: { initial?: ApiProduct; extraCategories: string[]; onSave: (data: Omit<ApiProduct, "id" | "sort_order" | "stock_qty" | "min_stock_qty">) => void; onClose: () => void }) {
  const [form, setForm] = useState<ProductFormState>(initial ? productToForm(initial) : EMPTY_FORM);
  const f = (key: keyof ProductFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const isCustomCategory = !ALL_CATEGORIES.includes(form.category as ProductCategory) && form.category !== "";
  const [showCustomInput, setShowCustomInput] = useState(isCustomCategory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await compressImage(file);
    setForm((s) => ({ ...s, imageUrl: dataUrl }));
  }

  const allSelectableCategories = [
    ...ALL_CATEGORIES,
    ...extraCategories.filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)),
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
                  <select
                    value={form.category}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_SENTINEL) { setShowCustomInput(true); setForm((s) => ({ ...s, category: "" })); }
                      else { setForm((s) => ({ ...s, category: e.target.value })); }
                    }}
                    className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</option>)}
                    {extraCategories.filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)).map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                    <option value={CUSTOM_SENTINEL}>+ Nueva categoría…</option>
                  </select>
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
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
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
                      {new Date(row.date + "T00:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })}
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

// ─── Fila sortable ────────────────────────────────────────────────────────────

function SortableProductRow({ product, onEdit, onViewUsage, isDragDisabled, exchangeRate }: { product: ApiProduct; onEdit: () => void; onViewUsage: () => void; isDragDisabled: boolean; exchangeRate: number }) {
  const deleteProduct = useDeleteCostProduct();
  const portions = calcPortions(product.presentation_qty, product.portion_qty);
  const hasCalc = portions != null && product.total_cost != null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id, disabled: isDragDisabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };

  return (
    <tr ref={setNodeRef} style={style} className="group hover:bg-slate-50/50 dark:hover:bg-gray-700/50 border-b border-slate-50 dark:border-gray-700">
      <td className="pl-2 pr-1 py-3 w-7">
        {!isDragDisabled && (
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing rounded p-0.5 text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 touch-none" title="Arrastrar">
            <GripVertical size={14} />
          </button>
        )}
      </td>
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
            {product.purchase_date && <p className="text-xs text-slate-400 dark:text-gray-500">Comprado: {new Date(product.purchase_date + "T00:00:00").toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })}</p>}
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
      <td className="pr-3 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onViewUsage} className="rounded p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-500" title="Ver uso por paciente"><Users size={13} /></button>
          <button onClick={onEdit} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500" title="Editar"><Edit2 size={13} /></button>
          <button onClick={() => { if (confirm(`¿Eliminar "${product.name}"?`)) deleteProduct.mutate(product.id); }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { data: products = [], isLoading } = useCostProducts();
  const { data: clinicSettings } = useClinicSettings();
  const exchangeRate = clinicSettings?.usd_exchange_rate ?? 37;
  const createProduct = useCreateCostProduct();
  const updateProduct = useUpdateCostProduct();
  const reorderProducts = useReorderCostProducts();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [usageProduct, setUsageProduct] = useState<ApiProduct | null>(null);

  const hasFilter = search.trim() !== "" || category !== "all";
  const isDragDisabled = search.trim() !== "";

  const allCategoriesInUse: string[] = [
    ...ALL_CATEGORIES,
    ...products.map((p) => p.category).filter((c) => !ALL_CATEGORIES.includes(c as ProductCategory)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || p.category === category;
    return matchSearch && matchCat;
  });

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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/costos" className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Catálogo de Productos</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">Actualiza precios aquí y se reflejan en todos los tratamientos automáticamente</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus size={15} /> Nuevo producto</Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input type="text" placeholder="Buscar producto o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
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
            <p className="text-sm text-slate-400 dark:text-gray-500">Prueba con otro filtro o agrega un producto nuevo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 text-xs text-slate-500 dark:text-gray-400">
                <th className="w-7 pl-2" />
                <th className="px-3 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Categoría</th>
                <th className="px-4 py-3 text-left font-medium">Presentación / uso</th>
                <th className="px-4 py-3 text-right font-medium">Costo total</th>
                <th className="px-5 py-3 text-right font-medium">C$/uso</th>
                <th className="w-16 py-3" />
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filtered.map((p) => (
                    <SortableProductRow key={p.id} product={p} onEdit={() => setEditingProduct(p)} onViewUsage={() => setUsageProduct(p)} isDragDisabled={isDragDisabled} exchangeRate={exchangeRate} />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-gray-500 text-center">
        {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
        {isDragDisabled ? " · Limpia la búsqueda para reordenar" : " · Arrastra para reordenar · Pasa el mouse para editar"}
      </p>

      {showNew && (
        <ProductModal
          extraCategories={allCategoriesInUse}
          onSave={(data) => createProduct.mutate(data)}
          onClose={() => setShowNew(false)}
        />
      )}
      {editingProduct && (
        <ProductModal
          initial={editingProduct}
          extraCategories={allCategoriesInUse}
          onSave={(data) => updateProduct.mutate({ id: editingProduct.id, ...data })}
          onClose={() => setEditingProduct(null)}
        />
      )}
      {usageProduct && (
        <ProductUsageModal product={usageProduct} onClose={() => setUsageProduct(null)} />
      )}
    </div>
  );
}
