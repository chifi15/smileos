"use client";

import { useState, useEffect, useMemo } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useTreatmentQuote } from "@/hooks/useOdontogram";
import { useProcedures } from "@/hooks/useCatalog";
import { useAddMultipleItems } from "@/hooks/useTreatments";
import { QuoteItem } from "@/types";

interface ImportRow {
  id: string;           // quote item id
  toothNumber: number | null;
  procedureId: string;
  procedureName: string;
  price: number | null;
  priority: "normal" | "urgent";
  selected: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  planId: string;
}

function toothLabel(n: number | null) {
  return n != null ? `Diente ${n}` : "Sin pieza";
}

export default function ImportFromOdontogramModal({ open, onClose, patientId, planId }: Props) {
  const { data: quote = [], isLoading: loadingQuote } = useTreatmentQuote(patientId);
  const { data: procedures = [], isLoading: loadingProcs } = useProcedures();
  const addMultiple = useAddMultipleItems(patientId, planId, () => onClose());

  const [rows, setRows] = useState<ImportRow[]>([]);

  useEffect(() => {
    if (!open || loadingQuote) return;
    setRows(
      quote.map((item: QuoteItem) => ({
        id: item.id,
        toothNumber: item.toothNumber,
        procedureId: item.procedureId,
        procedureName: item.procedureName,
        price: item.price,
        priority: "normal",
        selected: true,
      }))
    );
  }, [open, quote, loadingQuote]);

  function toggle(id: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, selected: !r.selected } : r));
  }
  function setField<K extends keyof ImportRow>(id: string, field: K, value: ImportRow[K]) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }
  function selectAll() { setRows((prev) => prev.map((r) => ({ ...r, selected: true }))); }
  function deselectAll() { setRows((prev) => prev.map((r) => ({ ...r, selected: false }))); }

  const selected = rows.filter((r) => r.selected);

  const procOptions = [
    { value: "", label: "Seleccionar..." },
    ...procedures.filter((p) => p.is_active).map((p) => ({
      value: p.id,
      label: p.code ? `${p.code} — ${p.name}` : p.name,
    })),
  ];

  function handleAdd() {
    const items = selected.map((r) => ({
      procedure_id: r.procedureId,
      tooth_fdi: r.toothNumber != null ? String(r.toothNumber) : null,
      priority: r.priority,
      notes: null,
      quoted_price: r.price,
    }));
    addMultiple.mutate(items);
  }

  // Group rows by tooth for display
  const groupedKeys = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of rows) {
      const key = r.toothNumber != null ? String(r.toothNumber) : "__none__";
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
    return keys;
  }, [rows]);

  const byTooth = useMemo(() => {
    const map = new Map<string, ImportRow[]>();
    for (const r of rows) {
      const key = r.toothNumber != null ? String(r.toothNumber) : "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [rows]);

  const isLoading = loadingQuote || loadingProcs;

  return (
    <Modal open={open} onClose={onClose} title="Importar desde cotización" size="lg">
      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : quote.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
          <ScanLine size={32} className="opacity-40" />
          <p className="text-sm text-center">
            La cotización del odontograma está vacía.
          </p>
          <p className="text-xs text-slate-400 text-center">
            Agrega procedimientos en la sección "Cotización" del odontograma del paciente primero.
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <strong className="text-slate-800">{quote.length}</strong> procedimiento{quote.length !== 1 ? "s" : ""} en la cotización
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Seleccionar todos</button>
              <span className="text-slate-300">·</span>
              <button onClick={deselectAll} className="text-xs text-slate-400 hover:underline">Deseleccionar</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[55vh] overflow-y-auto">
            {groupedKeys.map((key) => {
              const toothRows = byTooth.get(key)!;
              const toothNum = key !== "__none__" ? parseInt(key) : null;
              return (
                <div key={key} className="border-b border-slate-100 last:border-b-0">
                  {/* Tooth header */}
                  <div className="px-4 py-2 bg-slate-50 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {toothLabel(toothNum)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {toothRows.length} procedimiento{toothRows.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Procedures for this tooth */}
                  {toothRows.map((row) => (
                    <div
                      key={row.id}
                      className={[
                        "px-4 py-3 transition-colors border-t border-slate-50",
                        row.selected ? "bg-white" : "bg-slate-50 opacity-60",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggle(row.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600 shrink-0"
                        />
                        <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_100px]">
                          {/* Procedure */}
                          <select
                            value={row.procedureId}
                            onChange={(e) => {
                              const proc = procedures.find((p) => p.id === e.target.value);
                              setField(row.id, "procedureId", e.target.value);
                              if (proc) setField(row.id, "procedureName", proc.name);
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            {procOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {/* Priority */}
                          <select
                            value={row.priority}
                            onChange={(e) => setField(row.id, "priority", e.target.value as "normal" | "urgent")}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgente</option>
                          </select>
                          {/* Price */}
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">C$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={row.price ?? ""}
                              onChange={(e) =>
                                setField(row.id, "price", e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm text-slate-500">
                {selected.length} procedimiento{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}
              </p>
              {selected.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Total: C$ {selected.reduce((s, r) => s + (r.price ?? 0), 0).toLocaleString("es-NI")}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleAdd}
                loading={addMultiple.isPending}
                disabled={selected.length === 0}
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
