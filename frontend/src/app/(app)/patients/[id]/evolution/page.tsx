"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import {
  useEvolutions,
  useCreateEvolution,
  useUpdateEvolution,
  useDeleteEvolution,
} from "@/hooks/useEvolution";
import { PatientEvolution, EvolutionAttendance } from "@/types";
import Spinner from "@/components/ui/Spinner";

const ATTENDANCE_LABELS: Record<EvolutionAttendance, string> = {
  asistio: "Asistió",
  no_asistio: "No asistió",
};

const ATTENDANCE_STYLES: Record<EvolutionAttendance, string> = {
  asistio: "bg-green-100 text-green-700",
  no_asistio: "bg-red-100 text-red-600",
};

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function todayParts() {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function toIso(day: number, month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, month: m, year: y };
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

interface DatePickerProps {
  day: number;
  month: number;
  year: number;
  onChange: (day: number, month: number, year: number) => void;
}

function DatePicker({ day, month, year, onChange }: DatePickerProps) {
  const maxDay = daysInMonth(month, year);
  const safeDay = Math.min(day, maxDay);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const sel = "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="flex gap-2">
      <select
        value={safeDay}
        onChange={(e) => onChange(Number(e.target.value), month, year)}
        className={`w-20 ${sel}`}
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{String(d).padStart(2, "0")}</option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onChange(safeDay, Number(e.target.value), year)}
        className={`flex-1 ${sel}`}
      >
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(safeDay, month, Number(e.target.value))}
        className={`w-24 ${sel}`}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

interface FormState {
  day: number;
  month: number;
  year: number;
  note: string;
  attendance: EvolutionAttendance | "";
}

function EvolutionForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial: FormState;
  onSubmit: (values: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [values, setValues] = useState<FormState>(initial);

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
          <DatePicker
            day={values.day}
            month={values.month}
            year={values.year}
            onChange={(day, month, year) => setValues((p) => ({ ...p, day, month, year }))}
          />
        </div>
        <div className="sm:w-44">
          <label className="block text-xs font-medium text-slate-600 mb-1">Asistencia (opcional)</label>
          <select
            value={values.attendance}
            onChange={(e) => setValues((p) => ({ ...p, attendance: e.target.value as EvolutionAttendance | "" }))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Sin registro —</option>
            <option value="asistio">Asistió</option>
            <option value="no_asistio">No asistió</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Nota de evolución *
        </label>
        <textarea
          autoFocus
          rows={4}
          value={values.note}
          onChange={(e) => setValues((p) => ({ ...p, note: e.target.value }))}
          placeholder="Describe el tratamiento realizado, observaciones clínicas, indicaciones al paciente…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">
          Cancelar
        </button>
        <button
          type="button"
          disabled={isPending || !values.note.trim()}
          onClick={() => onSubmit(values)}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
    </div>
  );
}

function EvolutionCard({
  evo,
  onEdit,
  onDelete,
}: {
  evo: PatientEvolution;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateFormatted = format(parseISO(evo.date), "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="flex gap-4 px-5 py-4">
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className="h-3 w-3 rounded-full border-2 border-blue-400 bg-white" />
        <div className="flex-1 w-px bg-slate-100 mt-1" />
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 capitalize">{dateFormatted}</span>
            {evo.attendance && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ATTENDANCE_STYLES[evo.attendance]}`}>
                {evo.attendance === "asistio"
                  ? <CheckCircle2 size={11} />
                  : <XCircle size={11} />}
                {ATTENDANCE_LABELS[evo.attendance]}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
          {evo.note}
        </p>
        {evo.created_by && (
          <p className="mt-2 text-xs text-slate-400">
            Por {evo.created_by.full_name} ·{" "}
            {format(parseISO(evo.created_at), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EvolutionPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const { data: patient } = usePatient(patientId);
  const { data: evolutions = [], isLoading } = useEvolutions(patientId);

  const create = useCreateEvolution(patientId, () => setShowForm(false));
  const update = useUpdateEvolution(patientId);
  const remove = useDeleteEvolution(patientId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm: FormState = { ...todayParts(), note: "", attendance: "" };

  function formToIso(values: FormState) {
    return toIso(values.day, values.month, values.year);
  }

  function handleCreate(values: FormState) {
    create.mutate({
      date: formToIso(values),
      note: values.note,
      attendance: (values.attendance as EvolutionAttendance) || null,
    });
  }

  function handleUpdate(evo: PatientEvolution, values: FormState) {
    update.mutate(
      {
        evolutionId: evo.id,
        body: {
          date: formToIso(values),
          note: values.note,
          attendance: (values.attendance as EvolutionAttendance) || null,
        },
      },
      { onSuccess: () => setEditingId(null) }
    );
  }

  function handleDelete(evo: PatientEvolution) {
    if (window.confirm("¿Eliminar esta nota de evolución?")) {
      remove.mutate(evo.id);
    }
  }

  function evoToForm(evo: PatientEvolution): FormState {
    return { ...fromIso(evo.date), note: evo.note, attendance: evo.attendance ?? "" };
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <Link
          href={`/patients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={16} />
          {patient?.full_name ?? "Paciente"}
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Evolución clínica</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {evolutions.length > 0
              ? `${evolutions.length} nota${evolutions.length !== 1 ? "s" : ""}`
              : "Sin notas aún"}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            Nueva nota
          </button>
        )}
      </div>

      {showForm && (
        <EvolutionForm
          initial={emptyForm}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={create.isPending}
        />
      )}

      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : evolutions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
            <p className="text-sm">No hay notas de evolución registradas.</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus size={15} />
                Agregar primera nota
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {evolutions.map((evo) =>
              editingId === evo.id ? (
                <div key={evo.id} className="px-5 py-4">
                  <EvolutionForm
                    initial={evoToForm(evo)}
                    onSubmit={(values) => handleUpdate(evo, values)}
                    onCancel={() => setEditingId(null)}
                    isPending={update.isPending}
                  />
                </div>
              ) : (
                <EvolutionCard
                  key={evo.id}
                  evo={evo}
                  onEdit={() => { setEditingId(evo.id); setShowForm(false); }}
                  onDelete={() => handleDelete(evo)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
