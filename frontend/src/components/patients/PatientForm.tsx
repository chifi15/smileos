"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { differenceInYears, parseISO } from "date-fns";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { PatientFormValues, EMPTY_PATIENT_FORM } from "@/types";

function toDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function toISO(display: string): string {
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function DateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [raw, setRaw] = useState(() => toDisplay(value));
  const focused = useRef(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused.current) setRaw(toDisplay(value));
  }, [value]);

  function buildMasked(digits: string): string {
    const d = digits.slice(0, 8);
    let r = d.slice(0, 2);
    if (d.length > 2) r += "/" + d.slice(2, 4);
    if (d.length > 4) r += "/" + d.slice(4);
    return r;
  }

  function posAfterDigit(masked: string, digitIdx: number): number {
    let dc = -1;
    for (let i = 0; i < masked.length; i++) {
      if (masked[i] !== "/") {
        dc++;
        if (dc === digitIdx) {
          let pos = i + 1;
          while (pos < masked.length && masked[pos] === "/") pos++;
          return pos;
        }
      }
    }
    return masked.length;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = ref.current!;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;
    const curDigits = raw.replace(/\D/g, "");
    const digitsBefore = raw.slice(0, selStart).replace(/\D/g, "").length;
    const digitsInSel = raw.slice(selStart, selEnd).replace(/\D/g, "").length;

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      let newDigits: string;
      let afterDigits: number;

      if (selStart !== selEnd) {
        newDigits = curDigits.slice(0, digitsBefore) + curDigits.slice(digitsBefore + digitsInSel);
        afterDigits = digitsBefore;
      } else if (e.key === "Backspace" && digitsBefore > 0) {
        newDigits = curDigits.slice(0, digitsBefore - 1) + curDigits.slice(digitsBefore);
        afterDigits = digitsBefore - 1;
      } else if (e.key === "Delete" && digitsBefore < curDigits.length) {
        newDigits = curDigits.slice(0, digitsBefore) + curDigits.slice(digitsBefore + 1);
        afterDigits = digitsBefore;
      } else {
        return;
      }

      const newMasked = buildMasked(newDigits);
      setRaw(newMasked);
      const pos = afterDigits > 0 ? posAfterDigit(newMasked, afterDigits - 1) : 0;
      requestAnimationFrame(() => el.setSelectionRange(pos, pos));
      const iso = toISO(newMasked);
      if (iso) onChange(iso);
      return;
    }

    if (!/^\d$/.test(e.key)) return;

    e.preventDefault();
    if (curDigits.length >= 8 && selStart === selEnd) return;

    const newDigits = (
      curDigits.slice(0, digitsBefore) +
      e.key +
      curDigits.slice(digitsBefore + digitsInSel)
    ).slice(0, 8);

    const newMasked = buildMasked(newDigits);
    setRaw(newMasked);
    const pos = posAfterDigit(newMasked, digitsBefore);
    requestAnimationFrame(() => el.setSelectionRange(pos, pos));

    const iso = toISO(newMasked);
    if (iso) onChange(iso);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Fecha de nacimiento</label>
      <input
        ref={ref}
        type="text"
        value={raw}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setRaw(toDisplay(value)); }}
        onPaste={(e) => e.preventDefault()}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        inputMode="numeric"
        className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function calcAge(dob: string): string | null {
  if (!dob) return null;
  try {
    const age = differenceInYears(new Date(), parseISO(dob));
    return `${age} años`;
  } catch {
    return null;
  }
}

interface PatientFormProps {
  defaultValues?: Partial<PatientFormValues>;
  onSubmit: (values: PatientFormValues) => void;
  isPending?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 border-b border-slate-100 dark:border-gray-700 pb-2 text-sm font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

const GENDER_OPTIONS = [
  { value: "", label: "Sin especificar" },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "other", label: "Otro" },
];

const BLOOD_TYPE_OPTIONS = [
  { value: "", label: "Desconocido" },
  ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({
    value: v,
    label: v,
  })),
];

export default function PatientForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Guardar paciente",
  onCancel,
}: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>({
    ...EMPTY_PATIENT_FORM,
    ...defaultValues,
  });

  function field(name: keyof PatientFormValues) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => setValues((prev) => ({ ...prev, [name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Personal */}
      <Section title="Datos personales">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nombre *"
            value={values.first_name}
            onChange={field("first_name")}
            required
            autoFocus
          />
          <Input
            label="Apellido *"
            value={values.last_name}
            onChange={field("last_name")}
            required
          />
          <DateInput
            value={values.date_of_birth}
            onChange={(iso) => setValues((v) => ({ ...v, date_of_birth: iso }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Edad</label>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 text-sm text-slate-700 dark:text-gray-300">
              {calcAge(values.date_of_birth) ?? (
                <span className="text-slate-400 dark:text-gray-500">—</span>
              )}
            </div>
          </div>
          <Input
            label="Ciudad"
            value={values.city}
            onChange={field("city")}
            placeholder="Masaya, Managua..."
          />
          <Input
            label="País"
            value={values.country}
            onChange={field("country")}
            placeholder="Nicaragua"
          />
          <Select
            label="Género"
            value={values.gender}
            onChange={field("gender")}
            options={GENDER_OPTIONS}
          />
          <Input
            label="Cédula / Documento"
            value={values.id_number}
            onChange={field("id_number")}
            placeholder="001-000000-0000X"
          />
          <Input
            label="Profesión / Ocupación"
            value={values.occupation}
            onChange={field("occupation")}
            placeholder="Docente, enfermero, contador..."
            className="sm:col-span-2"
          />
        </div>
      </Section>

      {/* Chief complaint */}
      <Section title="Motivo de consulta">
        <Textarea
          label="Motivo de consulta"
          value={values.chief_complaint}
          onChange={field("chief_complaint")}
          rows={3}
          placeholder="¿Por qué viene el paciente? Describe el motivo principal de la visita..."
        />
      </Section>

      {/* Contact */}
      <Section title="Contacto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Teléfono"
            value={values.phone}
            onChange={field("phone")}
            placeholder="8888-0000"
          />
          <Input
            label="Teléfono alternativo"
            value={values.phone_secondary}
            onChange={field("phone_secondary")}
            placeholder="8888-0000"
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={values.email}
            onChange={field("email")}
            placeholder="paciente@correo.com"
            className="sm:col-span-2"
          />
          <Input
            label="Dirección"
            value={values.address}
            onChange={field("address")}
            placeholder="Colonia, calle, número de casa"
            className="sm:col-span-2"
          />
          <Input
            label="Contacto de emergencia"
            value={values.emergency_contact_name}
            onChange={field("emergency_contact_name")}
            placeholder="Nombre del contacto"
          />
          <Input
            label="Teléfono de emergencia"
            value={values.emergency_contact_phone}
            onChange={field("emergency_contact_phone")}
            placeholder="8888-0000"
          />
        </div>
      </Section>

      {/* Medical */}
      <Section title="Información médica">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Tipo de sangre"
            value={values.blood_type}
            onChange={field("blood_type")}
            options={BLOOD_TYPE_OPTIONS}
          />
          <div />
          <Textarea
            label="Alergias"
            value={values.allergies}
            onChange={field("allergies")}
            rows={3}
            placeholder="Penicilina, látex..."
            className="sm:col-span-2"
          />
          <Textarea
            label="Condiciones médicas"
            value={values.medical_conditions}
            onChange={field("medical_conditions")}
            rows={3}
            placeholder="Diabetes, hipertensión..."
            className="sm:col-span-2"
          />
          <Textarea
            label="Medicamentos actuales"
            value={values.current_medications}
            onChange={field("current_medications")}
            rows={3}
            placeholder="Metformina 500mg..."
            className="sm:col-span-2"
          />
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notas internas">
        <Textarea
          label="Notas"
          value={values.notes}
          onChange={field("notes")}
          rows={4}
          placeholder="Observaciones generales del paciente..."
        />
      </Section>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-gray-700 pt-6">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
