"use client";

import { useState, useEffect, useMemo } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useOdontogram, useTreatmentQuote } from "@/hooks/useOdontogram";
import { useProcedures } from "@/hooks/useCatalog";
import { useAddMultipleItems } from "@/hooks/useTreatments";
import { TOOTH_CONDITION_LABELS, ToothCondition } from "@/types";

const TREATABLE: ToothCondition[] = [
  "caries",
  "obturado",
  "endodoncia",
  "corona",
  "extraccion_indicada",
  "implante",
  "fractura",
  "necrosis_pulpar",
  "desgaste",
];

const CONDITION_PRIORITY: Partial<Record<ToothCondition, "urgent" | "normal">> = {
  extraccion_indicada: "urgent",
  fractura: "urgent",
};

interface ToothRow {
  tooth_number: number;
  condition: ToothCondition;
  notes: string | null;
  selected: boolean;
  procedure_id: string;
  priority: "normal" | "urgent";
  price: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
}

export default function ImportFromOdontogramModal({ open, onClose, patientId, planId }: Props) {
  const { data: teeth = [], isLoading: loadingOdonto } = useOdontogram(patientId, "inicial");
  const { data: procedures = [], isLoading: loadingProcs } = useProcedures();
  const { data: quote = [] } = useTreatmentQuote(patientId);
  const addMultiple = useAddMultipleItems(patientId, planId, () => onClose());

  const [rows, setRows] = useState<ToothRow[]>([]);

  const treatableTeeth = useMemo(
    () =>
      teeth
        .filter((t) => TREATABLE.includes(t.condition as ToothCondition))
        .sort((a, b) => a.tooth_number - b.tooth_number),
    [teeth]
  );

  // Build a lookup: toothNumber → list of quote items for that tooth
  const quoteByTooth = useMemo(() => {
    const map = new Map<number, typeof quote>();
    for (const item of quote) {
      if (item.toothNumber != null) {
        if (!map.has(item.toothNumber)) map.set(item.toothNumber, []);
        map.get(item.toothNumber)!.push(item);
      }
    }
    return map;
  }, [quote]);

  useEffect(() => {
    if (!open || procedures.length === 0) return;
    setRows(
      treatableTeeth.map((t) => {
        const toothQuotes = quoteByTooth.get(t.tooth_number) ?? [];
        // Pre-select procedure and price from the first matching quote item for this tooth
        const firstQuote = toothQuotes[0];
        const matchedProc = firstQuote
          ? procedures.find((p) => p.id === firstQuote.procedureId)
          : undefined;
        return {
          tooth_number: t.tooth_number,
          condition: t.condition as ToothCondition,
          notes: t.notes,
          selected: true,
          procedure_id: firstQuote?.procedureId ?? "",
          priority: CONDITION_PRIORITY[t.condition as ToothCondition] ?? "normal",
          price: firstQuote?.price ?? matchedProc?.default_price ?? null,
        };
      })
    );
  }, [open, treatableTeeth, procedures, quoteByTooth]);

  function toggleRow(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }

  function handleProcedureChange(idx: number, procedureId: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        // Look for a matching quote item for this tooth + procedure
        const toothQuotes = quoteByTooth.get(r.tooth_number) ?? [];
        const matched = toothQuotes.find((q) => q.procedureId === procedureId);
        const proc = procedures.find((p) => p.id === procedureId);
        return {
          ...r,
          procedure_id: procedureId,
          price: matched?.price ?? proc?.default_price ?? null,
        };
      })
    );
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
      quoted_price: r.price,
    }));
    addMultiple.mutate(items);
  }

  const isLoading = loadingOdonto || loadingProcs;

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

                {/* Selectores: procedimiento + prioridad + precio */}
                {row.selected && (
                  <div className="ml-7 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_100px]">
                    <select
                      value={row.procedure_id}
                      onChange={(e) => handleProcedureChange(idx, e.target.value)}
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
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">C$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={row.price ?? ""}
                        onChange={(e) =>
                          setField(idx, "price", e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
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
            <div>
              <p className="text-sm text-slate-500">
                {selected.length} diente{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}
              </p>
              {selected.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Total: C$ {selected.reduce((s, r) => s + (r.price ?? 0), 0).toLocaleString("es-NI")}
                </p>
              )}
            </div>
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
