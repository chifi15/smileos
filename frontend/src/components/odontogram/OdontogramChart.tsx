"use client";

import { useState } from "react";
import { ToothCondition, TOOTH_CONDITION_LABELS, OdontogramTooth } from "@/types";
import { cn } from "@/lib/utils";

const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const ALL_CONDITIONS: ToothCondition[] = [
  "sano", "caries", "obturado", "endodoncia",
  "corona", "extraccion_indicada", "extraido", "implante", "fractura",
];

// Configuración visual por condición
const CONDITION_STYLE: Record<ToothCondition, {
  bg: string;
  border: string;
  label: string;
  dot: string;
  symbol: string | null;
}> = {
  sano:                { bg: "#ffffff", border: "#94a3b8", label: "#64748b", dot: "#e2e8f0", symbol: null },
  caries:              { bg: "#fee2e2", border: "#ef4444", label: "#b91c1c", dot: "#ef4444", symbol: "●" },
  obturado:            { bg: "#dbeafe", border: "#3b82f6", label: "#1d4ed8", dot: "#3b82f6", symbol: "■" },
  endodoncia:          { bg: "#ede9fe", border: "#7c3aed", label: "#5b21b6", dot: "#7c3aed", symbol: "⊕" },
  corona:              { bg: "#fef9c3", border: "#ca8a04", label: "#92400e", dot: "#ca8a04", symbol: "♛" },
  extraccion_indicada: { bg: "#ffedd5", border: "#ea580c", label: "#9a3412", dot: "#ea580c", symbol: "↓" },
  extraido:            { bg: "#f1f5f9", border: "#94a3b8", label: "#64748b", dot: "#94a3b8", symbol: "✕" },
  implante:            { bg: "#dcfce7", border: "#16a34a", label: "#14532d", dot: "#16a34a", symbol: "⌇" },
  fractura:            { bg: "#ffe4e6", border: "#be123c", label: "#881337", dot: "#be123c", symbol: "⚡" },
};

// Forma SVG del diente
function ToothSVG({ isUpper, condition, isSelected }: {
  isUpper: boolean;
  condition: ToothCondition;
  isSelected: boolean;
}) {
  const style = CONDITION_STYLE[condition];
  const isMissing = condition === "extraido";

  if (isMissing) {
    return (
      <svg width="28" height="38" viewBox="0 0 28 38">
        {/* Diente fantasma */}
        {isUpper ? (
          <path d="M4,38 L4,14 Q4,2 14,2 Q24,2 24,14 L24,38 Z"
            fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,2" />
        ) : (
          <path d="M4,0 L4,24 Q4,36 14,36 Q24,36 24,24 L24,0 Z"
            fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,2" />
        )}
        {/* X */}
        <line x1="9" y1="12" x2="19" y2="26" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
        <line x1="19" y1="12" x2="9" y2="26" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }

  return (
    <svg width="28" height="38" viewBox="0 0 28 38">
      {/* Cuerpo del diente */}
      {isUpper ? (
        <path
          d="M4,38 L4,14 Q4,2 14,2 Q24,2 24,14 L24,38 Z"
          fill={style.bg}
          stroke={isSelected ? "#3b82f6" : style.border}
          strokeWidth={isSelected ? 2.5 : 2}
        />
      ) : (
        <path
          d="M4,0 L4,24 Q4,36 14,36 Q24,36 24,24 L24,0 Z"
          fill={style.bg}
          stroke={isSelected ? "#3b82f6" : style.border}
          strokeWidth={isSelected ? 2.5 : 2}
        />
      )}

      {/* Símbolo de condición */}
      {style.symbol && (
        <text
          x="14"
          y={isUpper ? "26" : "22"}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={condition === "corona" ? "13" : condition === "extraccion_indicada" ? "16" : "12"}
          fill={style.label}
          fontWeight="bold"
        >
          {style.symbol}
        </text>
      )}

      {/* Punto verde de sano */}
      {condition === "sano" && (
        <circle cx="14" cy={isUpper ? "26" : "18"} r="2.5" fill="#e2e8f0" />
      )}

      {/* Borde extra para seleccionado */}
      {isSelected && (
        isUpper ? (
          <path d="M4,38 L4,14 Q4,2 14,2 Q24,2 24,14 L24,38 Z"
            fill="none" stroke="#93c5fd" strokeWidth="1" opacity="0.6" />
        ) : (
          <path d="M4,0 L4,24 Q4,36 14,36 Q24,36 24,24 L24,0 Z"
            fill="none" stroke="#93c5fd" strokeWidth="1" opacity="0.6" />
        )
      )}
    </svg>
  );
}

interface ToothCellProps {
  tooth: OdontogramTooth | undefined;
  number: number;
  isUpper: boolean;
  editable: boolean;
  onClick: (num: number) => void;
  isSelected: boolean;
}

function ToothCell({ tooth, number, isUpper, editable, onClick, isSelected }: ToothCellProps) {
  const condition = tooth?.condition ?? "sano";
  const style = CONDITION_STYLE[condition];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5",
        editable && "cursor-pointer",
      )}
      onClick={() => editable && onClick(number)}
      title={`${number} — ${TOOTH_CONDITION_LABELS[condition]}`}
    >
      {isUpper && (
        <span className="text-[9px] font-mono" style={{ color: style.label }}>
          {number}
        </span>
      )}
      <div className={cn(
        "transition-transform",
        editable && "hover:scale-110",
        isSelected && "scale-110 drop-shadow-md",
      )}>
        <ToothSVG isUpper={isUpper} condition={condition} isSelected={isSelected} />
      </div>
      {!isUpper && (
        <span className="text-[9px] font-mono" style={{ color: style.label }}>
          {number}
        </span>
      )}
    </div>
  );
}

interface ToothEditorProps {
  tooth: OdontogramTooth | undefined;
  number: number;
  onSave: (condition: ToothCondition, notes: string | null) => void;
  onClose: () => void;
}

function ToothEditor({ tooth, number, onSave, onClose }: ToothEditorProps) {
  const [condition, setCondition] = useState<ToothCondition>(tooth?.condition ?? "sano");
  const [notes, setNotes] = useState(tooth?.notes ?? "");

  return (
    <div className="rounded-xl bg-white shadow-2xl border border-slate-200 p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ToothSVG isUpper={true} condition={condition} isSelected={false} />
          <h3 className="font-semibold text-slate-800">Pieza {number}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
      </div>

      <div className="grid grid-cols-1 gap-1 mb-3 max-h-64 overflow-y-auto">
        {ALL_CONDITIONS.map((c) => {
          const s = CONDITION_STYLE[c];
          const isActive = condition === c;
          return (
            <button
              key={c}
              onClick={() => setCondition(c)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border-2",
                isActive ? "shadow-sm scale-[1.02]" : "border-transparent hover:border-slate-200 bg-slate-50 hover:bg-white"
              )}
              style={isActive ? {
                backgroundColor: s.bg,
                borderColor: s.border,
                color: s.label,
              } : {}}
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 border-2"
                style={{ backgroundColor: s.bg, borderColor: s.border, color: s.label }}
              >
                {s.symbol ?? "·"}
              </span>
              <span style={isActive ? { color: s.label } : { color: "#475569" }}>
                {TOOTH_CONDITION_LABELS[c]}
              </span>
            </button>
          );
        })}
      </div>

      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
        placeholder="Notas (opcional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => { onSave(condition, notes.trim() || null); onClose(); }}
          className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

interface Props {
  teeth: OdontogramTooth[];
  editable?: boolean;
  onChange?: (toothNumber: number, condition: ToothCondition, notes: string | null) => void;
}

export default function OdontogramChart({ teeth, editable = false, onChange }: Props) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const toothMap = new Map(teeth.map((t) => [t.tooth_number, t]));

  function handleToothClick(num: number) {
    setSelectedTooth(num === selectedTooth ? null : num);
  }

  function handleSave(num: number, condition: ToothCondition, notes: string | null) {
    onChange?.(num, condition, notes);
    setSelectedTooth(null);
  }

  return (
    <div className="relative select-none">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-5 pb-4 border-b border-slate-100">
        {ALL_CONDITIONS.map((c) => {
          const s = CONDITION_STYLE[c];
          return (
            <span key={c} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span
                className="inline-flex w-4 h-4 items-center justify-center rounded border-2 text-[9px] font-bold shrink-0"
                style={{ backgroundColor: s.bg, borderColor: s.border, color: s.label }}
              >
                {s.symbol ?? "·"}
              </span>
              {TOOTH_CONDITION_LABELS[c]}
            </span>
          );
        })}
      </div>

      {/* Arcada */}
      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-5 border border-slate-200">
        {/* Superior */}
        <div className="flex justify-center gap-0.5">
          {UPPER_ROW.map((num) => (
            <ToothCell
              key={num}
              number={num}
              tooth={toothMap.get(num)}
              isUpper={true}
              editable={editable}
              onClick={handleToothClick}
              isSelected={selectedTooth === num}
            />
          ))}
        </div>

        {/* Línea de oclusión */}
        <div className="my-3 flex items-center gap-2">
          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
          <span className="text-[10px] text-slate-400 whitespace-nowrap px-1">línea de oclusión</span>
          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
        </div>

        {/* Inferior */}
        <div className="flex justify-center gap-0.5">
          {LOWER_ROW.map((num) => (
            <ToothCell
              key={num}
              number={num}
              tooth={toothMap.get(num)}
              isUpper={false}
              editable={editable}
              onClick={handleToothClick}
              isSelected={selectedTooth === num}
            />
          ))}
        </div>
      </div>

      {editable && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Haz clic en cualquier pieza para registrar su diagnóstico
        </p>
      )}

      {/* Editor flotante */}
      {selectedTooth !== null && editable && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedTooth(null)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <ToothEditor
              number={selectedTooth}
              tooth={toothMap.get(selectedTooth)}
              onSave={(condition, notes) => handleSave(selectedTooth, condition, notes)}
              onClose={() => setSelectedTooth(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}
