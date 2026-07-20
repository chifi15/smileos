"use client";

import { useState, useEffect, useMemo } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useOdontogram } from "@/hooks/useOdontogram";
import { useProcedures } from "@/hooks/useCatalog";
import { useAddMultipleItems } from "@/hooks/useTreatments";
import { TOOTH_CONDITION_LABELS, ToothCondition } from "@/types";

// Condiciones que requieren tratamiento (sano y extraído quedan fuera)
const TREATABLE: ToothCondition[] = [
  "caries",
  "obturado",
  "endodoncia",
  "corona",
  "extraccion_indicada",
  "implante",
  "fractura",
];

// Prioridad sugerida por condición
const CONDITION_PRIORITY: Partial<Record<ToothCondition, "urgent" | "normal">> = {
  extraccion_indicada: "urgent",
  fractura: "urgent",
};


// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ToothRow {
  tooth_number: number;
  condition: ToothCondition;
  notes: string | null;
  selected: boolean;
  procedure_id: string;
  priority: "normal" | "urgent";
}

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ImportFromOdontogramModal({ open, onClose, patientId, planId }: Props) {
  const { data: teeth = [], isLoading: loadingOdonto } = useOdontogram(patientId, "inicial");
  const { data: procedures = [], isLoading: loadingProcs } = useProcedures();
  const addMultiple = useAddMultipleItems(patientId, planId, () => onClose());

  const [rows, setRows] = useState<ToothRow[]>([]);

  // Inicializar filas cuando cargan los datos
  const treatableTeeth = useMemo(
    () =>
      teeth
        .filter((t) => TREATABLE.includes(t.condition as ToothCondition))
        .sort((a, b) => a.tooth_number - b.tooth_number),
    [teeth]
  );

  useEffect(() => {
    if (!open || procedures.length === 0) return;
    setRows(
      treatableTeeth.map((t) => ({
        tooth_number: t.tooth_number,
        condition: t.condition as ToothCondition,
        notes: t.notes,
        selected: true,
        procedure_id: "",
        priority: CONDITION_PRIORITY[t.condition as ToothCondition] ?? "normal",
      }))
    );
  }, [open, treatableTeeth, procedures]);

  function toggleRow(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }
  function setField<K extends keyof ToothRow>(idx: number, field: K, value: ToothRow[K]) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function selectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: true })));
  }
  function deselectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  }

  const selected = rows.filter((r) => r.selected);
  const missingProc = selected.some((r) => !r.procedure_id);

  function handleAdd() {
    if (missingProc) return;
    const items = selected.map((r) => ({
      procedure_id: r.procedure_id,
      tooth_fdi: String(r.tooth_number),
      priority: r.priority,
      notes: r.notes || null,
      quoted_price: null,
    }));
    addMultiple.mutate(items);
  }

  const isLoading = loadingOdonto || loadingProcs;

  // Opciones del select de procedimientos
  const procOptions = [
    { value: "", label: "Seleccionar procedimiento..." },
    ...procedures
      .filter((p) => p.is_active)
      .map((p) => ({
        value: p.id,
        label: p.code ? `${p.code} — ${p.name}` : p.name,
      })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar desde odontograma"
      size="lg"
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : treatableTeeth.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
          <ScanLine size={32} className="opacity-40" />
          <p className="text-sm text-center">
            El odontograma inicial no tiene dientes con condiciones que requieran tratamiento.
          </p>
          <p className="text-xs text-slate-400">
            Registra las condiciones en el odontograma del paciente primero.
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Se encontraron <strong className="text-slate-800">{treatableTeeth.length}</strong> dientes con
              condiciones que pueden requerir tratamiento.
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                Seleccionar todos
              </button>
              <span className="text-slate-300">·</span>
              <button onClick={deselectAll} className="text-xs text-slate-400 hover:underline">
                Deseleccionar
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden max-h-[55vh] overflow-y-auto">
            {rows.map((row, idx) => (
              <div
                key={row.tooth_number}
                className={[
                  "px-4 py-3 transition-colors",
                  row.selected ? "bg-white" : "bg-slate-50 opacity-60",
                ].join(" ")}
              >
                {/* Fila principal: checkbox + diente + condición */}
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(idx)}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-semibold text-slate-800 text-sm">
                      Diente {row.tooth_number}
                    </span>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        row.condition === "extraccion_indicada" || row.condition === "fractura"
                          ? "bg-red-100 text-red-700"
                          : row.condition === "caries"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {TOOTH_CONDITION_LABELS[row.condition]}
                    </span>
                    {row.condition === "extraccion_indicada" && (
                      <AlertTriangle size={13} className="text-red-500" />
                    )}
                  </div>
                </div>

                {/* Selectores: procedimiento + prioridad */}
                {row.selected && (
                  <div className="ml-7 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                    <select
                      value={row.procedure_id}
                      onChange={(e) => setField(idx, "procedure_id", e.target.value)}
                      className={[
                        "w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400",
                        !row.procedure_id
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      {procOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.priority}
                      onChange={(e) =>
                        setField(idx, "priority", e.target.value as "normal" | "urgent")
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                )}

                {/* Notas del odontograma */}
                {row.selected && row.notes && (
                  <p className="ml-7 mt-1 text-xs text-slate-400 italic">{row.notes}</p>
                )}
              </div>
            ))}
          </div>

          {missingProc && selected.length > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Asigna un procedimiento a cada diente seleccionado antes de continuar.
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-slate-500">
              {selected.length} diente{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleAdd}
                loading={addMultiple.isPending}
                disabled={selected.length === 0 || missingProc}
              >
                Agregar al plan ({selected.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
