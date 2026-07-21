"use client";

import { useState, FormEvent } from "react";
import { differenceInYears, parseISO } from "date-fns";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { PatientFormValues, EMPTY_PATIENT_FORM } from "@/types";

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
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">
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
          <div>
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={values.date_of_birth}
              onChange={field("date_of_birth")}
            />
            {calcAge(values.date_of_birth) && (
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Edad: {calcAge(values.date_of_birth)}
              </p>
            )}
          </div>
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
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
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
