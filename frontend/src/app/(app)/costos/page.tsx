"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Package,
  ChevronRight,
  TrendingUp,
  Plus,
  Calendar,
  Trash2,
  X,
} from "lucide-react";
import { useCostosStore } from "@/stores/costos.store";
import { calculateTreatmentCosts, fmtC } from "@/lib/costos-utils";
import { Treatment } from "@/types/costos";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── New Treatment Modal ──────────────────────────────────────────────────────

function NewTreatmentModal({ onClose }: { onClose: () => void }) {
  const addTreatment = useCostosStore((s) => s.addTreatment);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyFee, setHourlyFee] = useState("192");
  const [hours, setHours] = useState("1");
  const [fixedCosts, setFixedCosts] = useState("216");
  const [margin, setMargin] = useState("15");
  const [numCitas, setNumCitas] = useState("1");

  function handleCreate() {
    if (!name.trim()) return;
    const n = Math.max(1, parseInt(numCitas) || 1);
    const appointments = Array.from({ length: n }, (_, i) => ({
      id: `${crypto.randomUUID()}`,
      number: i + 1,
      name: n === 1 ? "Cita única" : `Cita ${i + 1}`,
      materials: [],
    }));
    const treatment: Treatment = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      appointments,
      professionalFeePerHour: parseFloat(hourlyFee) || 192,
      totalHours: parseFloat(hours) || 1,
      fixedCosts: parseFloat(fixedCosts) || 216,
      clinicMarginPct: (parseFloat(margin) || 15) / 100,
    };
    addTreatment(treatment);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-800">Nuevo tratamiento</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Input
            label="Nombre del tratamiento"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Blanqueamiento dental"
            autoFocus
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Breve descripción del tratamiento..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número de citas"
              type="number"
              min={1}
              value={numCitas}
              onChange={(e) => setNumCitas(e.target.value)}
            />
            <Input
              label="Horas totales"
              type="number"
              step="0.5"
              min={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Tarifa/hora (C$)"
              type="number"
              value={hourlyFee}
              onChange={(e) => setHourlyFee(e.target.value)}
            />
            <Input
              label="Costos fijos (C$)"
              type="number"
              value={fixedCosts}
              onChange={(e) => setFixedCosts(e.target.value)}
            />
            <Input
              label="Margen (%)"
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleCreate} disabled={!name.trim()}>
            Crear tratamiento
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Card ───────────────────────────────────────────────────────────

function TreatmentCard({ treatment }: { treatment: Treatment }) {
  const products = useCostosStore((s) => s.products);
  const deleteTreatment = useCostosStore((s) => s.deleteTreatment);
  const breakdown = calculateTreatmentCosts(treatment, products);

  const marginPct = breakdown.subtotal > 0
    ? ((breakdown.finalPrice - breakdown.subtotal) / breakdown.subtotal) * 100
    : 0;

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (confirm(`¿Eliminar "${treatment.name}"?`)) deleteTreatment(treatment.id);
        }}
        className="absolute right-3 top-3 hidden rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 group-hover:flex"
      >
        <Trash2 size={14} />
      </button>

      <Link href={`/costos/${treatment.id}`} className="block">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <Calculator size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 truncate pr-6">{treatment.name}</h3>
            {treatment.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{treatment.description}</p>
            )}
          </div>
        </div>

        {/* Citas badge */}
        <div className="mb-4 flex items-center gap-2">
          {treatment.appointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              <Calendar size={10} />
              Cita {apt.number}
            </div>
          ))}
        </div>

        {/* Costs grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Costo operativo</p>
            <p className="text-sm font-semibold text-slate-800">{fmtC(breakdown.totalMaterialsCost)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2.5">
            <p className="text-xs text-blue-600 mb-0.5">Precio paciente</p>
            <p className="text-sm font-bold text-blue-700">{fmtC(breakdown.finalPrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Total real (con honorarios)</p>
            <p className="text-sm font-semibold text-slate-700">{fmtC(breakdown.subtotal)}</p>
          </div>
          <div className="rounded-lg bg-green-50 px-3 py-2.5">
            <p className="text-xs text-green-600 mb-0.5">Utilidad estimada</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-green-600" />
              <p className="text-sm font-semibold text-green-700">
                {fmtC(breakdown.finalPrice - breakdown.subtotal)}{" "}
                <span className="text-xs font-normal">({marginPct.toFixed(0)}%)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>{treatment.appointments.length} cita{treatment.appointments.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1 text-blue-600 font-medium">
            Ver detalle <ChevronRight size={12} />
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostosPage() {
  const treatments = useCostosStore((s) => s.treatments);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Costos Operativos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Calcula y compara el costo por tratamiento dividido por citas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/costos/productos">
            <Button variant="secondary" size="sm">
              <Package size={15} />
              Catálogo de productos
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            Nuevo tratamiento
          </Button>
        </div>
      </div>

      {/* Treatments grid */}
      {treatments.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <Calculator size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sin tratamientos</p>
          <p className="text-sm text-slate-400 mt-1">Crea el primer tratamiento para comenzar</p>
          <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Nuevo tratamiento
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {treatments.map((t) => (
            <TreatmentCard key={t.id} treatment={t} />
          ))}
        </div>
      )}

      {showModal && <NewTreatmentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
