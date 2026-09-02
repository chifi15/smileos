"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Pencil, Check, X } from "lucide-react";
import { useHonorariosConfig, useUpdateHonorariosConfig } from "@/hooks/useCostos";
import { fmtC, fmt } from "@/lib/costos-utils";
import toast from "react-hot-toast";

export default function HonorariosPage() {
  const { data: config, isLoading } = useHonorariosConfig();
  const updateHonorarios = useUpdateHonorariosConfig();
  const router = useRouter();

  const feePerHour = config?.fee_per_hour ?? 192;

  // Editar tarifa directa
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("");

  // Derivar tarifa desde meta mensual
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState("");
  const [editingHoras, setEditingHoras] = useState(false);
  const [horasDraft, setHorasDraft] = useState("");
  const [metaMensual, setMetaMensual] = useState(0);
  const [horasMes, setHorasMes] = useState(0);
  const derivedRate = horasMes > 0 ? metaMensual / horasMes : 0;

  function saveFee() {
    const v = parseFloat(feeDraft);
    if (isNaN(v) || v <= 0) { setEditingFee(false); return; }
    updateHonorarios.mutate(
      { fee_per_hour: v },
      {
        onSuccess: (res) => {
          const synced = res?.procedures_synced ?? 0;
          if (synced > 0) {
            toast.success(`Tarifa guardada. ${synced} procedimiento${synced !== 1 ? "s" : ""} actualizados.`);
          } else {
            toast.success("Tarifa de honorarios guardada.");
          }
        },
        onError: () => toast.error("Error al guardar la tarifa."),
      }
    );
    setEditingFee(false);
  }

  function applyDerived() {
    if (derivedRate <= 0) return;
    updateHonorarios.mutate(
      { fee_per_hour: Math.round(derivedRate * 100) / 100 },
      {
        onSuccess: (res) => {
          const synced = res?.procedures_synced ?? 0;
          if (synced > 0) {
            toast.success(`Tarifa calculada aplicada. ${synced} procedimiento${synced !== 1 ? "s" : ""} actualizados.`);
          } else {
            toast.success("Tarifa calculada aplicada.");
          }
        },
        onError: () => toast.error("Error al guardar la tarifa."),
      }
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 dark:text-gray-500">Cargando...</div></div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/costos")} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200">
          <ArrowLeft size={15} /> Costos
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Honorarios Profesionales</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">Configura la tarifa por hora que se aplica a todos los tratamientos</p>
        </div>
      </div>

      {/* Tarifa actual */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Tarifa por hora</h2>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Tarifa profesional actual</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Se aplica a todos los tratamientos al guardar</p>
            </div>
            {editingFee ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-slate-400 dark:text-gray-500">C$</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="0.5"
                  value={feeDraft}
                  onChange={(e) => setFeeDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveFee(); if (e.key === "Escape") setEditingFee(false); }}
                  onBlur={saveFee}
                  className="w-24 rounded-lg border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 dark:text-gray-500">/hora</span>
                <button onClick={saveFee} className="text-green-600 dark:text-green-400 hover:text-green-700"><Check size={14} /></button>
                <button onClick={() => setEditingFee(false)} className="text-slate-400"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setFeeDraft(String(feePerHour)); setEditingFee(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/f"
              >
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{fmtC(feePerHour)}/hora</span>
                <Pencil size={12} className="text-slate-300 dark:text-gray-600 group-hover/f:text-blue-500" />
              </button>
            )}
          </div>

          {/* Fórmula */}
          <div className="rounded-xl bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700 px-5 py-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Fórmula de honorarios</p>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-semibold text-slate-800 dark:text-white">Honorarios</span>
              <span className="text-slate-400">=</span>
              <span className="rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 font-mono text-xs">{fmtC(feePerHour)}/hora</span>
              <span className="text-slate-400">×</span>
              <span className="rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 font-mono text-xs">horas del tratamiento</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 pt-1 border-t border-slate-200 dark:border-gray-600">
              <span>Ejemplo: tratamiento de 2 horas</span>
              <span className="font-medium text-slate-700 dark:text-gray-300">= {fmtC(feePerHour * 2)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 px-4 py-3">
            <Info size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Al guardar, la tarifa (<strong>{fmtC(feePerHour)}/hora</strong>) se aplica automáticamente a todos los tratamientos. Los <strong>costos operativos del catálogo de procedimientos</strong> vinculados se actualizan al instante.
            </p>
          </div>
        </div>
      </div>

      {/* Derivar tarifa */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">Calcular tarifa desde meta mensual</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Opcional — define cuánto quieres ganar al mes y cuántas horas trabajas</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Meta de honorarios mensual</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Lo que quieres ganar en un mes</p>
            </div>
            {editingMeta ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-slate-400">C$</span>
                <input
                  autoFocus type="number" min="0" step="100"
                  value={metaDraft}
                  onChange={(e) => setMetaDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setMetaMensual(parseFloat(metaDraft) || 0); setEditingMeta(false); }
                    if (e.key === "Escape") setEditingMeta(false);
                  }}
                  onBlur={() => { setMetaMensual(parseFloat(metaDraft) || 0); setEditingMeta(false); }}
                  className="w-28 rounded-lg border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => { setMetaMensual(parseFloat(metaDraft) || 0); setEditingMeta(false); }} className="text-green-600"><Check size={13} /></button>
                <button onClick={() => setEditingMeta(false)} className="text-slate-400"><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => { setMetaDraft(String(metaMensual)); setEditingMeta(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/m">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{metaMensual > 0 ? fmtC(metaMensual) : "— Ingresar —"}</span>
                <Pencil size={12} className="text-slate-300 dark:text-gray-600 group-hover/m:text-blue-500" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Horas de trabajo por mes</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Horas clínicas disponibles al mes</p>
            </div>
            {editingHoras ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  autoFocus type="number" min="1" step="1"
                  value={horasDraft}
                  onChange={(e) => setHorasDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setHorasMes(parseFloat(horasDraft) || 0); setEditingHoras(false); }
                    if (e.key === "Escape") setEditingHoras(false);
                  }}
                  onBlur={() => { setHorasMes(parseFloat(horasDraft) || 0); setEditingHoras(false); }}
                  className="w-20 rounded-lg border border-blue-400 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400">horas</span>
                <button onClick={() => { setHorasMes(parseFloat(horasDraft) || 0); setEditingHoras(false); }} className="text-green-600"><Check size={13} /></button>
                <button onClick={() => setEditingHoras(false)} className="text-slate-400"><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => { setHorasDraft(String(horasMes)); setEditingHoras(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/h">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{horasMes > 0 ? `${horasMes} horas` : "— Ingresar —"}</span>
                <Pencil size={12} className="text-slate-300 dark:text-gray-600 group-hover/h:text-blue-500" />
              </button>
            )}
          </div>

          {/* Resultado del cálculo */}
          <div className="rounded-xl bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700 px-5 py-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-gray-400">Meta mensual</span>
              <span className="font-medium text-slate-700 dark:text-gray-300 tabular-nums">{metaMensual > 0 ? fmtC(metaMensual) : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-slate-200 dark:border-gray-600">
              <span className="text-slate-500 dark:text-gray-400">÷ Horas por mes</span>
              <span className="font-medium text-slate-700 dark:text-gray-300">{horasMes > 0 ? `${horasMes} horas` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-white">= Tarifa calculada</span>
              <span className="text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {derivedRate > 0 ? `${fmtC(derivedRate)}/hora` : "—"}
              </span>
            </div>
            {derivedRate > 0 && (
              <button
                onClick={applyDerived}
                disabled={updateHonorarios.isPending}
                className="mt-3 w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Aplicar {fmtC(Math.round(derivedRate * 100) / 100)}/hora como tarifa global
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
