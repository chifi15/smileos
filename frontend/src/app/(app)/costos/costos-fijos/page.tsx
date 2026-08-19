"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Check, X, Pencil, Info } from "lucide-react";
import { useFixedCosts, useUpdateFixedCosts, ApiFixedCostItem } from "@/hooks/useCostos";
import { fmtC, fmt } from "@/lib/costos-utils";
import Button from "@/components/ui/Button";

// ─── Fila editable ────────────────────────────────────────────────────────────

function ItemRow({ item, onUpdate, onDelete }: {
  item: ApiFixedCostItem;
  onUpdate: (updates: Partial<ApiFixedCostItem>) => void;
  onDelete: () => void;
}) {
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [editAmount, setEditAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(String(item.amount));

  function saveName() {
    const v = nameDraft.trim();
    if (v) onUpdate({ name: v });
    else setNameDraft(item.name);
    setEditName(false);
  }

  function saveAmount() {
    const v = parseFloat(amountDraft);
    if (!isNaN(v) && v >= 0) onUpdate({ amount: v });
    else setAmountDraft(String(item.amount));
    setEditAmount(false);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors group">
      <div className="flex-1 min-w-0">
        {editName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(item.name); setEditName(false); } }}
              onBlur={saveName}
              className="flex-1 rounded border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : (
          <button onClick={() => { setNameDraft(item.name); setEditName(true); }} className="flex items-center gap-1.5 group/n text-left">
            <span className="text-sm text-slate-700 dark:text-gray-300">{item.name}</span>
            <Pencil size={11} className="text-slate-300 dark:text-gray-600 group-hover/n:text-blue-500 shrink-0" />
          </button>
        )}
      </div>

      <div className="shrink-0">
        {editAmount ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 dark:text-gray-500">C$</span>
            <input
              autoFocus
              type="number"
              min="0"
              step="1"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAmount(); if (e.key === "Escape") { setAmountDraft(String(item.amount)); setEditAmount(false); } }}
              onBlur={saveAmount}
              className="w-24 rounded border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={saveAmount} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"><Check size={13} /></button>
            <button onClick={() => { setAmountDraft(String(item.amount)); setEditAmount(false); }} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => { setAmountDraft(String(item.amount)); setEditAmount(true); }} className="flex items-center gap-1.5 group/a">
            <span className="text-sm font-medium text-slate-800 dark:text-white tabular-nums w-24 text-right">C$ {fmt(item.amount)}</span>
            <Pencil size={11} className="text-slate-300 dark:text-gray-600 group-hover/a:text-blue-500 shrink-0" />
          </button>
        )}
      </div>

      <button onClick={onDelete} className="shrink-0 text-slate-300 dark:text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Eliminar">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Formulario agregar ───────────────────────────────────────────────────────

function AddItemForm({ onAdd, onDone }: { onAdd: (name: string, amount: number) => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  function handleAdd() {
    const n = name.trim();
    const a = parseFloat(amount);
    if (!n || isNaN(a) || a < 0) return;
    onAdd(n, a);
    setName("");
    setAmount("");
    onDone();
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800/30">
      <input
        autoFocus
        placeholder="Nombre del gasto (ej: Luz, Agua, Salario...)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onDone(); }}
        className="flex-1 rounded-lg border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-slate-500 dark:text-gray-400">C$</span>
        <input
          type="number" min="0" step="1" placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onDone(); }}
          className="w-24 rounded-lg border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400 dark:text-gray-500">/mes</span>
      </div>
      <button onClick={handleAdd} disabled={!name.trim() || !amount} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
        <Check size={15} />
      </button>
      <button onClick={onDone} className="shrink-0 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"><X size={15} /></button>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CostosFijosPage() {
  const { data: config, isLoading } = useFixedCosts();
  const updateFixedCosts = useUpdateFixedCosts();
  const [showAdd, setShowAdd] = useState(false);
  const [editingPatients, setEditingPatients] = useState(false);
  const [patientsDraft, setPatientsDraft] = useState("");
  const router = useRouter();

  const items = config?.items ?? [];
  const patientsPerMonth = config?.patients_per_month ?? 40;
  const totalMensual = items.reduce((s, i) => s + i.amount, 0);
  const perPaciente = patientsPerMonth > 0 ? totalMensual / patientsPerMonth : 0;

  function save(newItems: ApiFixedCostItem[], newPatients?: number) {
    if (!config) return;
    updateFixedCosts.mutate({ patients_per_month: newPatients ?? patientsPerMonth, items: newItems });
  }

  function handleUpdateItem(id: string, updates: Partial<ApiFixedCostItem>) {
    save(items.map((i) => i.id === id ? { ...i, ...updates } : i));
  }

  function handleDeleteItem(id: string) {
    save(items.filter((i) => i.id !== id));
  }

  function handleAddItem(name: string, amount: number) {
    const newItem: ApiFixedCostItem = { id: crypto.randomUUID(), name, amount };
    save([...items, newItem]);
  }

  function savePatients() {
    const v = parseInt(patientsDraft);
    if (!isNaN(v) && v > 0) save(items, v);
    setEditingPatients(false);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 dark:text-gray-500">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/costos")} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200">
          <ArrowLeft size={15} /> Costos
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Costos Fijos</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">Configura tus gastos mensuales fijos y cuántos pacientes los absorben</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Gastos mensuales fijos</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Agregar gasto
          </Button>
        </div>
        <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700 text-xs font-medium text-slate-400 dark:text-gray-500">
          <span className="flex-1">Concepto</span>
          <span className="w-24 text-right">Monto / mes</span>
          <span className="w-6" />
        </div>

        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">Sin gastos registrados. Agrega uno con el botón de arriba.</div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onUpdate={(u) => handleUpdateItem(item.id, u)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </div>
        )}

        {showAdd && <AddItemForm onAdd={handleAddItem} onDone={() => setShowAdd(false)} />}

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">Total mensual</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtC(totalMensual)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Cálculo por paciente</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Pacientes atendidos por mes</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Entre cuántos pacientes se divide el costo total</p>
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
                  className="w-20 rounded-lg border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={savePatients} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => setEditingPatients(false)} className="text-slate-400"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setPatientsDraft(String(patientsPerMonth)); setEditingPatients(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/p"
              >
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{patientsPerMonth} pacientes</span>
                <Pencil size={12} className="text-slate-300 dark:text-gray-600 group-hover/p:text-blue-500" />
              </button>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700 px-5 py-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-gray-400">Total mensual</span>
              <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{fmtC(totalMensual)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-slate-200 dark:border-gray-600">
              <span className="text-slate-500 dark:text-gray-400">÷ Pacientes por mes</span>
              <span className="font-medium text-slate-700 dark:text-gray-300">{patientsPerMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-white">= Costo fijo por paciente</span>
              <span className="text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">{fmtC(perPaciente)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 px-4 py-3">
            <Info size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Este valor (<strong>{fmtC(perPaciente)}</strong>) se aplica automáticamente a todos los tratamientos en el cálculo de costos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
