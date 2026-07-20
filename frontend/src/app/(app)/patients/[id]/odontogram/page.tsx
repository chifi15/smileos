"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, Save, History, Plus, Trash2, Calculator,
  Stethoscope, ClipboardList, Copy,
} from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import {
  useOdontogram, useUpdateOdontogram, useOdontogramSnapshots,
  useCopyInicialToTratamiento, useTreatmentQuote, useSaveTreatmentQuote,
} from "@/hooks/useOdontogram";
import { useProcedures } from "@/hooks/useCatalog";
import {
  ToothCondition, OdontogramTooth,
  TOOTH_CONDITION_LABELS, TOOTH_CONDITION_COLORS, QuoteItem,
} from "@/types";
import OdontogramChart from "@/components/odontogram/OdontogramChart";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";

interface PendingChange {
  condition: ToothCondition;
  notes: string | null;
}

// ─── Snapshot Viewer ──────────────────────────────────────────────────────────

function SnapshotViewer({ patientId, kind, onClose }: {
  patientId: string; kind: string; onClose: () => void;
}) {
  const { data: snapshots = [], isLoading } = useOdontogramSnapshots(patientId, kind);
  const [selected, setSelected] = useState<string | null>(null);
  const snap = selected ? snapshots.find((s) => s.id === selected) : null;
  const title = kind === "inicial"
    ? "Historial — Odontograma Inicial"
    : "Historial — Plan de Tratamiento";

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : snapshots.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Aún no hay registros guardados.
        </p>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          <div className="w-48 shrink-0 border-r border-slate-100 pr-3 overflow-y-auto max-h-[500px]">
            {snapshots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors mb-1 ${
                  selected === s.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <p className="font-medium">
                  {format(parseISO(s.created_at), "dd MMM yyyy", { locale: es })}
                </p>
                <p className="text-slate-400">{format(parseISO(s.created_at), "HH:mm")}</p>
                {s.snapshot_notes && (
                  <p className="mt-0.5 text-slate-500 truncate">{s.snapshot_notes}</p>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {!snap ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Selecciona un registro para ver el estado
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  Guardado por {snap.created_by?.full_name ?? "—"} el{" "}
                  {format(parseISO(snap.created_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                </div>
                {snap.snapshot_notes && (
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {snap.snapshot_notes}
                  </div>
                )}
                <div className="space-y-1">
                  {Object.entries(snap.teeth_data)
                    .filter(([, v]) => v.condition !== "sano")
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([num, v]) => (
                      <div key={num} className="flex items-center gap-2 text-xs">
                        <span className="w-8 font-mono text-slate-500">{num}</span>
                        <span className="font-medium text-slate-700">
                          {TOOTH_CONDITION_LABELS[v.condition]}
                        </span>
                        {v.notes && <span className="text-slate-400">— {v.notes}</span>}
                      </div>
                    ))}
                  {Object.values(snap.teeth_data).every((v) => v.condition === "sano") && (
                    <p className="text-xs text-slate-400">Todas las piezas en estado sano.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Odontogram Section (reutilizable para ambas pestañas) ────────────────────

function OdontogramSection({ patientId, kind }: { patientId: string; kind: string }) {
  const { data: teeth = [], isLoading } = useOdontogram(patientId, kind);
  const [pendingChanges, setPendingChanges] = useState<Record<number, PendingChange>>({});
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  const update = useUpdateOdontogram(patientId, kind, () => {
    setPendingChanges({});
    setSnapshotNotes("");
  });
  const copyFromInicial = useCopyInicialToTratamiento(patientId);

  const hasPending = Object.keys(pendingChanges).length > 0;

  // Build previewTeeth from all 32 fixed numbers so pending changes are
  // always visible even while the DB data is still loading.
  const teethByNum = new Map(teeth.map((t) => [t.tooth_number, t]));
  const ALL_NUMS = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,
                    31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
  const previewTeeth: OdontogramTooth[] = ALL_NUMS.map((num) => {
    const base: OdontogramTooth = teethByNum.get(num) ?? {
      id: `preview-${num}`,
      tooth_number: num,
      condition: "sano",
      notes: null,
      updated_at: null,
      updated_by: null,
    };
    const pending = pendingChanges[num];
    return pending ? { ...base, condition: pending.condition, notes: pending.notes } : base;
  });

  function handleToothChange(num: number, condition: ToothCondition, notes: string | null) {
    setPendingChanges((prev) => ({ ...prev, [num]: { condition, notes } }));
  }

  function handleSave() {
    if (!hasPending) return;
    update.mutate({ teeth: pendingChanges, snapshot_notes: snapshotNotes.trim() || null });
  }

  const affected = previewTeeth.filter((t) => t.condition !== "sano");

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          {kind === "tratamiento" && (
            confirmCopy ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">¿Sobrescribir con el estado actual del Odontograma Inicial?</span>
                <button
                  onClick={() => { copyFromInicial.mutate(); setConfirmCopy(false); }}
                  disabled={copyFromInicial.isPending}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {copyFromInicial.isPending ? "Copiando…" : "Sí, copiar"}
                </button>
                <button
                  onClick={() => setConfirmCopy(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmCopy(true)}>
                <Copy size={14} />
                Copiar desde Inicial
              </Button>
            )
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)}>
          <History size={15} />
          Historial
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
            <OdontogramChart
              teeth={previewTeeth}
              editable
              onChange={handleToothChange}
            />
          </div>

          {hasPending && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">
                {Object.keys(pendingChanges).length} pieza(s) modificada(s) sin guardar
              </p>
              <div className="space-y-1">
                {Object.entries(pendingChanges).map(([num, change]) => (
                  <div key={num} className="flex items-center gap-2 text-xs text-blue-700">
                    <span className="w-6 font-mono">{num}</span>
                    <span>→ {TOOTH_CONDITION_LABELS[change.condition]}</span>
                    {change.notes && <span className="text-blue-500">— {change.notes}</span>}
                  </div>
                ))}
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nota del registro (ej: Evaluación inicial, Post-tratamiento...)"
                value={snapshotNotes}
                onChange={(e) => setSnapshotNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPendingChanges({})}>
                  Descartar cambios
                </Button>
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save size={14} />
                  Guardar odontograma
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">
              Resumen — piezas con tratamiento
            </h2>
            {affected.length === 0 ? (
              <p className="text-sm text-slate-400">Todas las piezas en estado sano.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {affected.map((t) => {
                  const colors = TOOTH_CONDITION_COLORS[t.condition];
                  return (
                    <div
                      key={t.tooth_number}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${colors.bg} ${colors.border}`}
                    >
                      <span className={`text-base font-bold w-5 text-center ${colors.text}`}>
                        {colors.symbol}
                      </span>
                      <div>
                        <span className={`font-mono font-bold mr-1.5 ${colors.text}`}>{t.tooth_number}</span>
                        <span className={`font-medium ${colors.text}`}>{TOOTH_CONDITION_LABELS[t.condition]}</span>
                        {t.notes && (
                          <p className="text-slate-500 truncate mt-0.5">{t.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showHistory && (
        <SnapshotViewer patientId={patientId} kind={kind} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OdontogramPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: procedures = [] } = useProcedures();
  const { data: savedQuote = [] } = useTreatmentQuote(id);
  const saveQuote = useSaveTreatmentQuote(id);

  const [activeTab, setActiveTab] = useState<"inicial" | "tratamiento">("inicial");

  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  const [addTooth, setAddTooth] = useState<string>("");
  const [addProc, setAddProc] = useState<string>("");

  if (!quoteLoaded && savedQuote.length > 0) {
    setQuoteItems(savedQuote);
    setQuoteLoaded(true);
  }
  if (!quoteLoaded && savedQuote.length === 0 && !saveQuote.isPending) {
    setQuoteLoaded(true);
  }

  const quoteTotal = quoteItems.reduce((sum, i) => sum + i.price, 0);

  function handleAddQuoteItem() {
    const proc = procedures.find((p) => p.id === addProc);
    if (!proc) return;
    const newItems: QuoteItem[] = [...quoteItems, {
      id: Math.random().toString(36).slice(2),
      toothNumber: addTooth ? parseInt(addTooth) : null,
      procedureId: proc.id,
      procedureName: proc.name,
      price: proc.default_price ?? 0,
    }];
    setQuoteItems(newItems);
    saveQuote.mutate(newItems);
    setAddTooth("");
    setAddProc("");
  }

  function handleRemoveQuoteItem(itemId: string) {
    const newItems = quoteItems.filter((i) => i.id !== itemId);
    setQuoteItems(newItems);
    saveQuote.mutate(newItems);
  }

  function handleQuotePriceChange(itemId: string, newPrice: string) {
    const val = parseFloat(newPrice) || 0;
    const newItems = quoteItems.map((i) => i.id === itemId ? { ...i, price: val } : i);
    setQuoteItems(newItems);
    saveQuote.mutate(newItems);
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">Odontograma</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("inicial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "inicial"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Stethoscope size={15} />
          Odontograma Inicial
        </button>
        <button
          onClick={() => setActiveTab("tratamiento")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "tratamiento"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <ClipboardList size={15} />
          Plan de Tratamiento
        </button>
      </div>

      {/* Tab description */}
      {activeTab === "inicial" ? (
        <p className="text-xs text-slate-400 -mt-2">
          Registra el estado dental del paciente en su primera visita.
        </p>
      ) : (
        <p className="text-xs text-slate-400 -mt-2">
          Marca las intervenciones planificadas para el paciente.
        </p>
      )}

      {/* Odontogram section — key forces remount when tab changes so state resets */}
      <OdontogramSection key={activeTab} patientId={id} kind={activeTab} />

      {/* Cotización */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Calculator size={17} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">Cotización del plan de tratamiento</h2>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pieza (opcional)</label>
              <input
                type="number"
                placeholder="Ej: 16"
                value={addTooth}
                onChange={(e) => setAddTooth(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-slate-500 mb-1">Procedimiento *</label>
              <select
                value={addProc}
                onChange={(e) => setAddProc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccionar...</option>
                {procedures.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    {idx + 1}. {p.name}{p.default_price != null ? ` — C$ ${Number(p.default_price).toLocaleString("es-NI")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={handleAddQuoteItem} disabled={!addProc}>
              <Plus size={15} /> Agregar
            </Button>
          </div>
        </div>

        {quoteItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Agrega procedimientos para calcular el costo del tratamiento.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-12 px-5 py-2 text-xs font-medium text-slate-400 bg-slate-50">
                <span className="col-span-1">#</span>
                <span className="col-span-1">Pieza</span>
                <span className="col-span-5">Procedimiento</span>
                <span className="col-span-4 text-right">Precio (C$)</span>
                <span className="col-span-1" />
              </div>
              {quoteItems.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 items-center px-5 py-2.5 hover:bg-slate-50">
                  <span className="col-span-1 text-xs font-bold text-slate-400">{idx + 1}</span>
                  <span className="col-span-1 text-sm font-mono text-slate-500">
                    {item.toothNumber ?? "—"}
                  </span>
                  <span className="col-span-5 text-sm text-slate-700">{item.procedureName}</span>
                  <div className="col-span-4 flex justify-end">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.price}
                      onChange={(e) => handleQuotePriceChange(item.id, e.target.value)}
                      className="w-28 text-right rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => handleRemoveQuoteItem(item.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t-2 border-slate-100 bg-slate-50">
              <div>
                <p className="text-xs text-slate-400">{quoteItems.length} procedimiento(s)</p>
                <p className="text-xs text-slate-400 mt-0.5">Paciente: {patient?.full_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-0.5">Total estimado</p>
                <p className="text-2xl font-bold text-slate-800">
                  C$ {quoteTotal.toLocaleString("es-NI", { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
