"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Check, X, Pencil, Info } from "lucide-react";
import { useCostosStore } from "@/stores/costos.store";
import { FixedCostItem } from "@/types/costos";
import { fmtC, fmt } from "@/lib/costos-utils";
import Button from "@/components/ui/Button";

// ─── Fila editable ────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: FixedCostItem }) {
  const updateFixedCostItem = useCostosStore((s) => s.updateFixedCostItem);
  const deleteFixedCostItem = useCostosStore((s) => s.deleteFixedCostItem);

  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [editAmount, setEditAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(String(item.amount));

  function saveName() {
    const v = nameDraft.trim();
    if (v) updateFixedCostItem(item.id, { name: v });
    else setNameDraft(item.name);
    setEditName(false);
  }

  function saveAmount() {
    const v = parseFloat(amountDraft);
    if (!isNaN(v) && v >= 0) updateFixedCostItem(item.id, { amount: v });
    else setAmountDraft(String(item.amount));
    setEditAmount(false);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group">
      {/* Nombre */}
      <div className="flex-1 min-w-0">
        {editName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(item.name); setEditName(false); } }}
              onBlur={saveName}
              className="flex-1 rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : (
          <button
            onClick={() => { setNameDraft(item.name); setEditName(true); }}
            className="flex items-center gap-1.5 group/n text-left"
          >
            <span className="text-sm text-slate-700">{item.name}</span>
            <Pencil size={11} className="text-slate-300 group-hover/n:text-blue-500 shrink-0" />
          </button>
        )}
      </div>

      {/* Monto mensual */}
      <div className="shrink-0">
        {editAmount ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">C$</span>
            <input
              autoFocus
              type="number"
              min="0"
              step="1"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAmount(); if (e.key === "Escape") { setAmountDraft(String(item.amount)); setEditAmount(false); } }}
              onBlur={saveAmount}
              className="w-24 rounded border border-blue-400 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={saveAmount} className="text-green-600 hover:text-green-700"><Check size={13} /></button>
            <button onClick={() => { setAmountDraft(String(item.amount)); setEditAmount(false); }} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
        ) : (
          <button
            onClick={() => { setAmountDraft(String(item.amount)); setEditAmount(true); }}
            className="flex items-center gap-1.5 group/a"
          >
            <span className="text-sm font-medium text-slate-800 tabular-nums w-24 text-right">
              C$ {fmt(item.amount)}
            </span>
            <Pencil size={11} className="text-slate-300 group-hover/a:text-blue-500 shrink-0" />
          </button>
        )}
      </div>

      {/* Eliminar */}
      <button
        onClick={() => deleteFixedCostItem(item.id)}
        className="shrink-0 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Formulario agregar ───────────────────────────────────────────────────────

function AddItemForm({ onDone }: { onDone: () => void }) {
  const addFixedCostItem = useCostosStore((s) => s.addFixedCostItem);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  function handleAdd() {
    const n = name.trim();
    const a = parseFloat(amount);
    if (!n || isNaN(a) || a < 0) return;
    addFixedCostItem(n, a);
    setName("");
    setAmount("");
    onDone();
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border-t border-blue-100">
      <input
        autoFocus
        placeholder="Nombre del gasto (ej: Luz, Agua, Salario...)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onDone(); }}
        className="flex-1 rounded-lg border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-slate-500">C$</span>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onDone(); }}
          className="w-24 rounded-lg border border-blue-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400">/mes</span>
      </div>
      <button
        onClick={handleAdd}
        disabled={!name.trim() || !amount}
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        <Check size={15} />
      </button>
      <button onClick={onDone} className="shrink-0 text-slate-400 hover:text-slate-600">
        <X size={15} />
      </button>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CostosFijosPage() {
  const { fixedCostsConfig, setPatientsPerMonth } = useCostosStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingPatients, setEditingPatients] = useState(false);
  const [patientsDraft, setPatientsDraft] = useState("");
  const router = useRouter();

  const totalMensual = fixedCostsConfig.items.reduce((s, i) => s + i.amount, 0);
  const perPaciente = fixedCostsConfig.patientsPerMonth > 0
    ? totalMensual / fixedCostsConfig.patientsPerMonth
    : 0;

  function savePatients() {
    const v = parseInt(patientsDraft);
    if (!isNaN(v) && v > 0) setPatientsPerMonth(v);
    setEditingPatients(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/costos")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> Costos
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Costos Fijos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configura tus gastos mensuales fijos y cuántos pacientes los absorben
          </p>
        </div>
      </div>

      {/* Tabla de gastos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Gastos mensuales fijos</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Agregar gasto
          </Button>
        </div>

        {/* Cabecera */}
        <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400">
          <span className="flex-1">Concepto</span>
          <span className="w-24 text-right">Monto / mes</span>
          <span className="w-6" />
        </div>

        {/* Items */}
        {fixedCostsConfig.items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Sin gastos registrados. Agrega uno con el botón de arriba.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {fixedCostsConfig.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Formulario agregar */}
        {showAdd && <AddItemForm onDone={() => setShowAdd(false)} />}

        {/* Total */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">Total mensual</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtC(totalMensual)}</span>
        </div>
      </div>

      {/* Calculadora por paciente */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Cálculo por paciente</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Pacientes por mes */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Pacientes atendidos por mes</p>
              <p className="text-xs text-slate-400 mt-0.5">Entre cuántos pacientes se divide el costo total</p>
            </div>
            {editingPatients ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  autoFocus
                  type="number"
                  min="1"
                  value={patientsDraft}
                  onChange={(e) => setPatientsDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") savePatients(); if (e.key === "Escape") setEditingPatients(false); }}
                  onBlur={savePatients}
                  className="w-20 rounded-lg border border-blue-400 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={savePatients} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                <button onClick={() => setEditingPatients(false)} className="text-slate-400"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setPatientsDraft(String(fixedCostsConfig.patientsPerMonth)); setEditingPatients(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 hover:border-blue-300 hover:bg-blue-50 transition-colors group/p"
              >
                <span className="text-sm font-semibold text-slate-800">{fixedCostsConfig.patientsPerMonth} pacientes</span>
                <Pencil size={12} className="text-slate-300 group-hover/p:text-blue-500" />
              </button>
            )}
          </div>

          {/* Divisor visual */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Total mensual</span>
              <span className="font-medium text-slate-700 tabular-nums">{fmtC(totalMensual)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-slate-200">
              <span className="text-slate-500">÷ Pacientes por mes</span>
              <span className="font-medium text-slate-700">{fixedCostsConfig.patientsPerMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">= Costo fijo por paciente</span>
              <span className="text-xl font-bold text-blue-700 tabular-nums">{fmtC(perPaciente)}</span>
            </div>
          </div>

          {/* Nota */}
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Este valor (<strong>{fmtC(perPaciente)}</strong>) se aplica automáticamente a todos los tratamientos en el cálculo de costos. Cambia cualquier gasto y se actualiza en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
