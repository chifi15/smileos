"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useCreatePatient } from "@/hooks/usePatients";
import PatientForm from "@/components/patients/PatientForm";
import { PatientFormValues } from "@/types";

export default function NewPatientPage() {
  const create = useCreatePatient();

  function handleSubmit(values: PatientFormValues) {
    create.mutate(values);
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={16} />
          Pacientes
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">
          Nuevo paciente
        </h1>
      </div>

      <div className="max-w-2xl rounded-xl bg-white p-8 shadow-sm border border-slate-100">
        <PatientForm
          onSubmit={handleSubmit}
          isPending={create.isPending}
          submitLabel="Crear paciente"
          onCancel={() => window.history.back()}
        />
      </div>
    </div>
  );
}
