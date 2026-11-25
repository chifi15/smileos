"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAiPhotoAnalysis, type AiAnalysis } from "@/hooks/useOdontogram";
import { TOOTH_CONDITION_LABELS, ICDAS_LABELS, type ToothCondition, type OdontogramTooth } from "@/types";

interface Row {
  tooth: number;
  selected: boolean;
  condition: ToothCondition;
  icdas: number | null;
  confidence: "alta" | "media" | "baja";
  note: string;
  photos: number[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  currentTeeth: OdontogramTooth[];
  onApply: (changes: Record<number, { condition: ToothCondition; icdas: number | null; notes: string | null }>) => void;
}

const CONF_STYLE: Record<string, string> = {
  alta: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-red-100 text-red-700",
};

const CONDITIONS = Object.keys(TOOTH_CONDITION_LABELS).filter((c) => c !== "sano") as ToothCondition[];

export default function AiPhotoAnalysisModal({ open, onClose, patientId, currentTeeth, onApply }: Props) {
  const analyze = useAiPhotoAnalysis(patientId);
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<AiAnalysis | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) { setAccepted(false); setResult(null); setRows([]); analyze.reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function run() {
    analyze.mutate(undefined, {
      onSuccess: (data) => {
        setResult(data);
        setRows(
          data.suggestions.map((s) => ({
            tooth: s.tooth,
            selected: s.confidence !== "baja",
            condition: s.condition as ToothCondition,
            icdas: s.icdas,
            confidence: s.confidence,
            note: s.note,
            photos: s.photos,
          })),
        );
      },
    });
  }

  function setRow(tooth: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.tooth === tooth ? { ...r, ...patch } : r)));
  }

  const currentOf = (n: number) => currentTeeth.find((t) => t.tooth_number === n);
  const selected = rows.filter((r) => r.selected);

  function apply() {
    const changes: Parameters<Props["onApply"]>[0] = {};
    for (const r of selected) {
      changes[r.tooth] = {
        condition: r.condition,
        icdas: r.condition === "caries" ? r.icdas : null,
        notes: r.note || null,
      };
    }
    onApply(changes);
    onClose();
  }

  const errMsg = (analyze.error as { response?: { data?: { error?: { message?: string }; detail?: string } } } | null)
    ?.response?.data;
  const errorText = errMsg?.error?.message ?? errMsg?.detail ?? (analyze.isError ? "No se pudo completar el análisis." : null);

  return (
    <Modal open={open} onClose={onClose} title="Analizar fotos con IA" size="lg">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {!result && !analyze.isPending && (
          <>
            <p className="text-sm text-slate-600 dark:text-gray-300">
              La IA revisa las fotos del paciente clasificadas como sonrisa, laterales, oclusales y hemiarcadas, y
              <strong> propone</strong> el estado de cada pieza (con nivel ICDAS en caries). Tú revisas y corriges
              cada propuesta antes de guardarla; no se guarda nada automáticamente.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={13} /> Antes de continuar</p>
              <p>Las fotos se envían a un servicio externo de IA (Anthropic) para ser analizadas. Asegúrate de contar con el consentimiento del paciente.</p>
              <p>Es una ayuda, no un diagnóstico: con fotos no se evalúan bien las caries interproximales ni los códigos ICDAS 1 y 2 (requieren diente limpio y seco). Confirma siempre clínicamente.</p>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              El paciente consintió el uso de sus fotos para este análisis.
            </label>
            {errorText && <p className="text-sm text-red-600">{errorText}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
              <Button type="button" onClick={run} disabled={!accepted}>
                <Sparkles size={15} />
                Analizar
              </Button>
            </div>
          </>
        )}

        {analyze.isPending && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Spinner />
            <p className="text-sm text-slate-500 dark:text-gray-400">Analizando fotos… puede tardar hasta un minuto.</p>
          </div>
        )}

        {result && (
          <>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Fotos analizadas: {result.photos_used.map((p) => `${p.n}. ${p.label}`).join(" · ")}
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-gray-400">
                No se encontraron hallazgos claros en las fotos.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const cur = currentOf(r.tooth);
                  return (
                    <div key={r.tooth} className={`rounded-lg border p-3 ${r.selected ? "border-blue-300 dark:border-blue-700" : "border-slate-200 dark:border-gray-700 opacity-70"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={(e) => setRow(r.tooth, { selected: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        />
                        <span className="font-mono font-bold text-slate-800 dark:text-white w-8">{r.tooth}</span>
                        <select
                          value={r.condition}
                          onChange={(e) => setRow(r.tooth, { condition: e.target.value as ToothCondition, icdas: e.target.value === "caries" ? r.icdas : null })}
                          className="rounded-md border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs"
                        >
                          {CONDITIONS.map((c) => <option key={c} value={c}>{TOOTH_CONDITION_LABELS[c]}</option>)}
                        </select>
                        {r.condition === "caries" && (
                          <select
                            value={r.icdas ?? ""}
                            onChange={(e) => setRow(r.tooth, { icdas: e.target.value === "" ? null : parseInt(e.target.value) })}
                            className="rounded-md border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs"
                          >
                            <option value="">ICDAS —</option>
                            {Object.entries(ICDAS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONF_STYLE[r.confidence]}`}>
                          Confianza {r.confidence}
                        </span>
                        {cur && cur.condition !== "sano" && cur.condition !== r.condition && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-500">
                            actual: {TOOTH_CONDITION_LABELS[cur.condition]}
                          </span>
                        )}
                      </div>
                      <input
                        value={r.note}
                        onChange={(e) => setRow(r.tooth, { note: e.target.value })}
                        placeholder="Nota"
                        className="mt-2 w-full rounded-md border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 text-xs"
                      />
                      {r.photos.length > 0 && (
                        <p className="mt-1 text-[10px] text-slate-400 dark:text-gray-500">Visto en foto {r.photos.join(", ")}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {(result.general_notes || result.limitations) && (
              <div className="rounded-lg bg-slate-50 dark:bg-gray-700/50 p-3 text-xs text-slate-600 dark:text-gray-300 space-y-1">
                {result.general_notes && <p>{result.general_notes}</p>}
                {result.limitations && <p className="text-slate-500 dark:text-gray-400">Limitaciones: {result.limitations}</p>}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400 dark:text-gray-500">Las piezas sin marcar no se modifican.</p>
              <div className="flex gap-3">
                <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
                <Button type="button" onClick={apply} disabled={selected.length === 0}>
                  Aplicar {selected.length} pieza{selected.length === 1 ? "" : "s"} al odontograma
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
