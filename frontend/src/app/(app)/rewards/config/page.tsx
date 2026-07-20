"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Zap,
  Hand,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Gift,
} from "lucide-react";
import {
  useRewardsConfig,
  useUpdateRewardsConfig,
  RewardsConfigPayload,
} from "@/hooks/useRewards";
import { REWARDS_LEVEL_LABELS } from "@/types";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface EditablePoint {
  key: string;
  label: string;
  points: number;
  is_system: boolean;
  trigger: "auto" | "manual";
  originalPoints: number;
}

interface EditableLevel {
  level: string;
  label: string;
  threshold: number;
  is_editable: boolean;
  originalThreshold: number;
  discount_pct: number;
  perks: string[];
  originalDiscount: number;
  originalPerks: string[];
}

// ─── Fila de punto ────────────────────────────────────────────────────────────

function PointRow({
  entry,
  onChange,
  onDelete,
}: {
  entry: EditablePoint;
  onChange: (key: string, points: number) => void;
  onDelete?: (key: string) => void;
}) {
  const changed = entry.points !== entry.originalPoints;
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{entry.label}</p>
        <p className={`text-xs ${entry.trigger === "auto" ? "text-amber-600" : entry.is_system ? "text-violet-500" : "text-violet-600"}`}>
          {entry.trigger === "auto" ? "Automático" : entry.is_system ? "Manual" : "Manual · Personalizado"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <input
            type="number"
            min="0"
            max="9999"
            value={entry.points}
            onChange={(e) => onChange(entry.key, parseInt(e.target.value, 10) || 0)}
            className={[
              "w-20 rounded-lg border px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400",
              changed ? "border-yellow-400 bg-yellow-50 text-yellow-800" : "border-slate-200 bg-slate-50 text-slate-800",
            ].join(" ")}
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
        </div>
        {!entry.is_system && onDelete ? (
          <button onClick={() => onDelete(entry.key)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={15} />
          </button>
        ) : (
          <div className="w-[30px]" />
        )}
      </div>
    </div>
  );
}

// ─── Formulario agregar tipo personalizado ────────────────────────────────────

function AddCustomTypeForm({ onAdd }: { onAdd: (key: string, label: string, points: number) => void }) {
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");

  function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed || !points) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `custom_${Date.now()}`;
    onAdd(key, trimmed, parseInt(points, 10) || 0);
    setLabel("");
    setPoints("");
  }

  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Agregar tipo personalizado</p>
      <div className="flex items-end gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre (ej: Examen preventivo)"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <div className="relative w-24">
          <input
            type="number"
            min="1"
            max="9999"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Pts"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
        </div>
        <Button size="sm" variant="secondary" onClick={handleAdd} disabled={!label.trim() || !points}>
          <Plus size={14} />
          Agregar
        </Button>
      </div>
    </div>
  );
}

// ─── Editor de beneficios por nivel ──────────────────────────────────────────

const LEVEL_ICONS_MAP: Record<string, string> = {
  starter: "⬜", bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎",
};

const LEVEL_COLORS: Record<string, string> = {
  starter: "bg-slate-50 border-slate-200",
  bronze: "bg-amber-50 border-amber-200",
  silver: "bg-gray-50 border-gray-200",
  gold: "bg-yellow-50 border-yellow-200",
  diamond: "bg-violet-50 border-violet-200",
};

function LevelBenefitsEditor({
  lvl,
  onDiscountChange,
  onAddPerk,
  onDeletePerk,
}: {
  lvl: EditableLevel;
  onDiscountChange: (level: string, pct: number) => void;
  onAddPerk: (level: string, perk: string) => void;
  onDeletePerk: (level: string, index: number) => void;
}) {
  const [newPerk, setNewPerk] = useState("");
  const discountChanged = lvl.discount_pct !== lvl.originalDiscount;

  function handleAddPerk() {
    const t = newPerk.trim();
    if (!t) return;
    onAddPerk(lvl.level, t);
    setNewPerk("");
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${LEVEL_COLORS[lvl.level]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{LEVEL_ICONS_MAP[lvl.level]}</span>
          <span className="font-semibold text-slate-800">{lvl.label}</span>
          <span className="text-xs text-slate-400">desde {lvl.threshold.toLocaleString("es-NI")} pts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-500">Descuento:</span>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              value={lvl.discount_pct}
              onChange={(e) => onDiscountChange(lvl.level, parseInt(e.target.value, 10) || 0)}
              className={[
                "w-16 rounded-lg border px-2 py-1 text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400",
                discountChanged ? "border-yellow-400 bg-yellow-50 text-yellow-800" : "border-slate-200 bg-white text-slate-800",
              ].join(" ")}
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
          </div>
        </div>
      </div>

      {/* Lista de perks */}
      <div className="space-y-1.5">
        {lvl.perks.map((perk, i) => (
          <div key={i} className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-1.5">
            <span className="text-green-500 text-xs shrink-0">✓</span>
            <span className="flex-1 text-sm text-slate-700">{perk}</span>
            <button
              onClick={() => onDeletePerk(lvl.level, i)}
              className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {lvl.perks.length === 0 && (
          <p className="text-xs text-slate-400 italic px-1">Sin beneficios adicionales.</p>
        )}
      </div>

      {/* Agregar perk */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newPerk}
          onChange={(e) => setNewPerk(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddPerk()}
          placeholder="Ej: Limpieza de cortesía anual"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <button
          onClick={handleAddPerk}
          disabled={!newPerk.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Plus size={13} />
          Agregar
        </button>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function RewardsConfigPage() {
  const { data: config, isLoading } = useRewardsConfig();
  const updateConfig = useUpdateRewardsConfig();

  const [points, setPoints] = useState<EditablePoint[]>([]);
  const [levels, setLevels] = useState<EditableLevel[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!config) return;
    setPoints(
      config.points_table.map((e) => ({ ...e, originalPoints: e.points }))
    );
    setLevels(
      config.level_thresholds.map((l) => ({
        ...l,
        originalThreshold: l.threshold,
        originalDiscount: l.discount_pct,
        originalPerks: [...l.perks],
      }))
    );
    setIsDirty(false);
  }, [config]);

  function handlePointChange(key: string, pts: number) {
    setPoints((prev) => prev.map((e) => (e.key === key ? { ...e, points: pts } : e)));
    setIsDirty(true);
  }
  function handleDeleteCustom(key: string) {
    setPoints((prev) => prev.filter((e) => e.key !== key));
    setIsDirty(true);
  }
  function handleAddCustom(key: string, label: string, pts: number) {
    const finalKey = points.some((e) => e.key === key) ? `${key}_${Date.now()}` : key;
    setPoints((prev) => [
      ...prev,
      { key: finalKey, label, points: pts, is_system: false, trigger: "manual", originalPoints: 0 },
    ]);
    setIsDirty(true);
  }
  function handleLevelChange(level: string, threshold: number) {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, threshold } : l)));
    setIsDirty(true);
  }
  function handleDiscountChange(level: string, pct: number) {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, discount_pct: pct } : l)));
    setIsDirty(true);
  }
  function handleAddPerk(level: string, perk: string) {
    setLevels((prev) =>
      prev.map((l) => (l.level === level ? { ...l, perks: [...l.perks, perk] } : l))
    );
    setIsDirty(true);
  }
  function handleDeletePerk(level: string, index: number) {
    setLevels((prev) =>
      prev.map((l) =>
        l.level === level ? { ...l, perks: l.perks.filter((_, i) => i !== index) } : l
      )
    );
    setIsDirty(true);
  }

  function handleReset() {
    if (!config) return;
    setPoints(config.points_table.map((e) => ({ ...e, originalPoints: e.points })));
    setLevels(config.level_thresholds.map((l) => ({
      ...l,
      originalThreshold: l.threshold,
      originalDiscount: l.discount_pct,
      originalPerks: [...l.perks],
    })));
    setIsDirty(false);
  }

  function handleSave() {
    const points_overrides: Record<string, number> = {};
    const custom_types: Record<string, { label: string; points: number }> = {};
    for (const entry of points) {
      if (entry.is_system) {
        if (entry.points !== entry.originalPoints) points_overrides[entry.key] = entry.points;
      } else {
        custom_types[entry.key] = { label: entry.label, points: entry.points };
      }
    }
    const level_overrides: Record<string, number> = {};
    const level_benefits: Record<string, { discount_pct: number; perks: string[] }> = {};
    for (const lvl of levels) {
      if (lvl.is_editable && lvl.threshold !== lvl.originalThreshold) {
        level_overrides[lvl.level] = lvl.threshold;
      }
      level_benefits[lvl.level] = { discount_pct: lvl.discount_pct, perks: lvl.perks };
    }

    const payload: RewardsConfigPayload = { points_overrides, level_overrides, custom_types, level_benefits };
    updateConfig.mutate(payload, { onSuccess: () => setIsDirty(false) });
  }

  const autoTypes = points.filter((e) => e.trigger === "auto");
  const manualTypes = points.filter((e) => e.trigger === "manual");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronLeft size={16} />
            Smile Rewards
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">Configurar programa de puntos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Personaliza los puntos, umbrales de nivel y beneficios por nivel.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {isDirty && (
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw size={14} />
              Descartar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} loading={updateConfig.isPending} disabled={!isDirty}>
            <Save size={14} />
            Guardar cambios
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Sección 1: Puntos por acción */}
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Puntos por acción</h2>
              <p className="text-xs text-slate-500 mt-0.5">Los valores en amarillo tienen cambios sin guardar.</p>
            </div>

            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                <Zap size={13} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Automáticos — se otorgan solos al completar acciones
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {autoTypes.map((entry) => (
                  <PointRow key={entry.key} entry={entry} onChange={handlePointChange} />
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                <Hand size={13} className="text-violet-600" />
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  Manuales — el dentista los otorga según su criterio
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {manualTypes.map((entry) => (
                  <PointRow key={entry.key} entry={entry} onChange={handlePointChange} onDelete={handleDeleteCustom} />
                ))}
              </div>
              <AddCustomTypeForm onAdd={handleAddCustom} />
            </div>
          </div>

          {/* Sección 2: Umbrales de nivel */}
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Umbrales de nivel</h2>
              <p className="text-xs text-slate-500 mt-0.5">Puntos mínimos para alcanzar cada nivel.</p>
            </div>
            <div className="divide-y divide-slate-50">
              {levels.map((lvl) => {
                const changed = lvl.threshold !== lvl.originalThreshold;
                return (
                  <div key={lvl.level} className="flex items-center gap-4 px-4 py-3 bg-white">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {LEVEL_ICONS_MAP[lvl.level]} {lvl.label}
                      </p>
                      {!lvl.is_editable && <p className="text-xs text-slate-400">Siempre en 0 — punto de partida</p>}
                    </div>
                    <div className="relative w-28">
                      <input
                        type="number"
                        min="0"
                        max="99999"
                        value={lvl.threshold}
                        disabled={!lvl.is_editable}
                        onChange={(e) => handleLevelChange(lvl.level, parseInt(e.target.value, 10) || 0)}
                        className={[
                          "w-full rounded-lg border px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed",
                          changed ? "border-yellow-400 bg-yellow-50 text-yellow-800" : "border-slate-200 bg-slate-50 text-slate-800",
                        ].join(" ")}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección 3: Beneficios por nivel */}
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-yellow-500" />
                <h2 className="font-semibold text-slate-800">Beneficios por nivel</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Define el descuento y los beneficios que obtiene el paciente en cada nivel.
                Esto se muestra en su perfil y en su página de Smile Rewards.
              </p>
            </div>
            <div className="p-4 space-y-3">
              {levels.map((lvl) => (
                <LevelBenefitsEditor
                  key={lvl.level}
                  lvl={lvl}
                  onDiscountChange={handleDiscountChange}
                  onAddPerk={handleAddPerk}
                  onDeletePerk={handleDeletePerk}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center pb-2">
            Los cambios aplican de forma inmediata al guardar. Los puntos ya acumulados no se modifican.
          </p>
        </>
      )}
    </div>
  );
}

