"use client";

import { use, useState } from "react";
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
} from "lucide-react";
import { useCostosStore } from "@/stores/costos.store";
import { calculateTreatmentCosts, fmtC, fmt } from "@/lib/costos-utils";
import { PRODUCT_CATEGORY_COLORS, PRODUCT_CATEGORY_LABELS } from "@/types/costos";
import AppointmentAccordion from "@/components/costos/AppointmentAccordion";
import CostSummaryBar from "@/components/costos/CostSummaryBar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── Edit Treatment Settings Panel ────────────────────────────────────────────

function TreatmentSettings({ treatmentId }: { treatmentId: string }) {
  const treatment = useCostosStore((s) => s.treatments.find((t) => t.id === treatmentId));
  const updateTreatment = useCostosStore((s) => s.updateTreatment);
  const [open, setOpen] = useState(false);

  if (!treatment) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <DollarSign size={15} className="text-slate-400" />
          Honorarios y configuración de precio
        </div>
        {open ? (
          <ChevronUp size={15} className="text-slate-400" />
        ) : (
          <ChevronDown size={15} className="text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Tarifa/hora (C$)
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.professionalFeePerHour}
              onBlur={(e) =>
                updateTreatment(treatmentId, {
                  professionalFeePerHour: parseFloat(e.target.value) || 192,
                })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Total de horas
            </label>
            <input
              type="number"
              step="0.5"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.totalHours}
              onBlur={(e) =>
                updateTreatment(treatmentId, {
                  totalHours: parseFloat(e.target.value) || 1,
                })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Costos fijos (C$)
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.fixedCosts}
              onBlur={(e) =>
                updateTreatment(treatmentId, {
                  fixedCosts: parseFloat(e.target.value) || 216,
                })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Margen clínica (%)
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.clinicMarginPct * 100}
              onBlur={(e) =>
                updateTreatment(treatmentId, {
                  clinicMarginPct: (parseFloat(e.target.value) || 15) / 100,
                })
              }
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Precio sugerido al paciente (C$) — dejar vacío para usar el calculado
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={treatment.suggestedPrice ?? ""}
              placeholder="(usar precio calculado automáticamente)"
              onBlur={(e) =>
                updateTreatment(treatmentId, {
                  suggestedPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Material Panel ───────────────────────────────────────────────────────

function AddMaterialModal({
  treatmentId,
  appointmentId,
  onClose,
}: {
  treatmentId: string;
  appointmentId: string;
  onClose: () => void;
}) {
  const products = useCostosStore((s) => s.products);
  const treatment = useCostosStore((s) => s.treatments.find((t) => t.id === treatmentId));
  const updateTreatment = useCostosStore((s) => s.updateTreatment);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState("1");

  const apt = treatment?.appointments.find((a) => a.id === appointmentId);
  const existingIds = new Set(apt?.materials.map((m) => m.productId) ?? []);

  const filtered = products
    .filter((p) => !existingIds.has(p.id))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  function handleAdd() {
    if (!selected || !treatment) return;
    const updatedAppointments = treatment.appointments.map((a) => {
      if (a.id !== appointmentId) return a;
      return {
        ...a,
        materials: [...a.materials, { productId: selected, quantity: parseFloat(qty) || 1 }],
      };
    });
    updateTreatment(treatmentId, { appointments: updatedAppointments });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Agregar material</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
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
          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors ${selected === p.id ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-400">{fmtC(p.unitPrice)} / {p.portionDescription}</p>
                </div>
                {selected === p.id && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Cantidad (porciones):
              </label>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
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

// ─── Merge Appointment Modal ──────────────────────────────────────────────────

function MergeAppointmentModal({
  treatmentId,
  targetAppointmentId,
  onClose,
}: {
  treatmentId: string;
  targetAppointmentId: string;
  onClose: () => void;
}) {
  const treatment = useCostosStore((s) => s.treatments.find((t) => t.id === treatmentId));
  const products = useCostosStore((s) => s.products);
  const mergeAppointments = useCostosStore((s) => s.mergeAppointments);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!treatment) return null;

  const target = treatment.appointments.find((a) => a.id === targetAppointmentId);
  const others = treatment.appointments.filter((a) => a.id !== targetAppointmentId);

  function handleMerge() {
    if (!selectedId) return;
    mergeAppointments(treatmentId, targetAppointmentId, selectedId);
    onClose();
  }

  function materialCost(aptId: string) {
    const apt = treatment!.appointments.find((a) => a.id === aptId);
    if (!apt) return 0;
    return apt.materials.reduce((sum, m) => {
      const p = products.find((p) => p.id === m.productId);
      return sum + (p ? p.unitPrice * m.quantity : 0);
    }, 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Fusionar cita</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los materiales de la cita seleccionada se absorberán en <span className="font-medium text-slate-700">Cita {target?.number}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {others.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No hay otras citas para fusionar</p>
          )}
          {others.map((apt) => (
            <button
              key={apt.id}
              onClick={() => setSelectedId(apt.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedId === apt.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">
                  {apt.number}
                </div>
                <div>
                  <p className="font-medium text-slate-700 text-sm">{apt.name}</p>
                  <p className="text-xs text-slate-400">{apt.materials.length} materiales · {fmtC(materialCost(apt.id))}</p>
                </div>
              </div>
              {selectedId === apt.id && <Check size={15} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>

        {selectedId && (
          <div className="border-t border-slate-100 bg-amber-50 px-6 py-3">
            <p className="text-xs text-amber-700">
              La cita seleccionada desaparecerá y sus materiales se sumarán a la Cita {target?.number}. Esta acción no se puede deshacer.
            </p>
          </div>
        )}

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
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

// ─── Editable Appointment ─────────────────────────────────────────────────────

function EditableAppointment({
  treatmentId,
  detail,
  defaultOpen,
}: {
  treatmentId: string;
  detail: ReturnType<typeof calculateTreatmentCosts>["appointmentCosts"][number];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const products = useCostosStore((s) => s.products);
  const allAppointments = useCostosStore(
    (s) => s.treatments.find((t) => t.id === treatmentId)?.appointments ?? []
  );
  const treatment = useCostosStore((s) => s.treatments.find((t) => t.id === treatmentId));
  const updateTreatment = useCostosStore((s) => s.updateTreatment);
  const [editQty, setEditQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");

  const { appointment, materialCost, materials } = detail;

  function removeMaterial(productId: string) {
    if (!treatment) return;
    const updatedAppointments = treatment.appointments.map((a) => {
      if (a.id !== appointment.id) return a;
      return { ...a, materials: a.materials.filter((m) => m.productId !== productId) };
    });
    updateTreatment(treatmentId, { appointments: updatedAppointments });
  }

  function saveQty(productId: string) {
    if (!treatment) return;
    const newQty = parseFloat(editQtyValue);
    if (isNaN(newQty) || newQty <= 0) { setEditQty(null); return; }
    const updatedAppointments = treatment.appointments.map((a) => {
      if (a.id !== appointment.id) return a;
      return {
        ...a,
        materials: a.materials.map((m) =>
          m.productId === productId ? { ...m, quantity: newQty } : m
        ),
      };
    });
    updateTreatment(treatmentId, { appointments: updatedAppointments });
    setEditQty(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            {appointment.number}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{appointment.name}</p>
            <p className="text-xs text-slate-500">{materials.length} materiales</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Costo cita</p>
            <p className="font-semibold text-slate-800">{fmtC(materialCost)}</p>
          </div>
          {allAppointments.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setMergeOpen(true); }}
              title="Fusionar con otra cita"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
            >
              <Merge size={15} />
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
        <div className="border-t border-slate-100">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Package size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">Sin materiales en esta cita</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="px-5 py-2.5 text-left font-medium">Material</th>
                  <th className="px-4 py-2.5 text-right font-medium">P. unitario</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="w-10 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {materials.map(({ product, quantity, total }) => (
                  <tr key={product.id} className="group hover:bg-slate-50/50">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-700 text-sm">{product.name}</p>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${PRODUCT_CATEGORY_COLORS[product.category]}`}
                      >
                        {PRODUCT_CATEGORY_LABELS[product.category]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {fmtC(product.unitPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editQty === product.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            className="w-16 rounded border border-blue-400 px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editQtyValue}
                            onChange={(e) => setEditQtyValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQty(product.id);
                              if (e.key === "Escape") setEditQty(null);
                            }}
                          />
                          <button
                            onClick={() => saveQty(product.id)}
                            className="rounded p-0.5 text-green-600 hover:bg-green-50"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditQty(product.id);
                            setEditQtyValue(String(quantity));
                          }}
                          className="flex items-center justify-end gap-1 tabular-nums text-slate-700 hover:text-blue-600"
                        >
                          {quantity}
                          <Edit2 size={10} className="text-slate-300 group-hover:text-slate-400" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium text-slate-800">
                      {fmtC(total)}
                    </td>
                    <td className="pr-3 text-center">
                      <button
                        onClick={() => removeMaterial(product.id)}
                        className="hidden rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3 text-sm font-medium text-slate-600">
                    Subtotal cita {appointment.number}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">
                    {fmtC(materialCost)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}

          <div className="border-t border-slate-100 px-5 py-3">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> Agregar material
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <AddMaterialModal
          treatmentId={treatmentId}
          appointmentId={appointment.id}
          onClose={() => setAddOpen(false)}
        />
      )}
      {mergeOpen && (
        <MergeAppointmentModal
          treatmentId={treatmentId}
          targetAppointmentId={appointment.id}
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
  const products = useCostosStore((s) => s.products);
  const treatment = useCostosStore((s) => s.treatments.find((t) => t.id === id));
  const updateTreatment = useCostosStore((s) => s.updateTreatment);
  const [editName, setEditName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  if (!treatment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Tratamiento no encontrado</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push("/costos")}>
            <ArrowLeft size={14} /> Volver
          </Button>
        </div>
      </div>
    );
  }

  const breakdown = calculateTreatmentCosts(treatment, products);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-5">
      {/* Back + Title */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/costos")}
          className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> Costos
        </button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                className="text-xl font-bold text-slate-800 border-b-2 border-blue-500 bg-transparent focus:outline-none w-full"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateTreatment(id, { name: nameValue });
                    setEditName(false);
                  }
                  if (e.key === "Escape") setEditName(false);
                }}
              />
              <button
                onClick={() => { updateTreatment(id, { name: nameValue }); setEditName(false); }}
                className="text-green-600 hover:text-green-700"
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
              <h1 className="text-xl font-bold text-slate-800">{treatment.name}</h1>
              <Edit2 size={14} className="text-slate-300 group-hover:text-slate-500" />
            </button>
          )}
          {treatment.description && (
            <p className="text-sm text-slate-500 mt-0.5">{treatment.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={11} /> {treatment.totalHours}h profesional
            </span>
            <span>·</span>
            <span>{treatment.appointments.length} cita{treatment.appointments.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Cost Summary */}
      <CostSummaryBar breakdown={breakdown} />

      {/* Settings */}
      <TreatmentSettings treatmentId={id} />

      {/* Appointments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Materiales por cita</h2>
        {breakdown.appointmentCosts.map((detail, i) => (
          <EditableAppointment
            key={detail.appointment.id}
            treatmentId={id}
            detail={detail}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
