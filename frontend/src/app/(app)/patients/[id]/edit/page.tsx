"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { usePatient, useUpdatePatient } from "@/hooks/usePatients";
import PatientForm from "@/components/patients/PatientForm";
import Spinner from "@/components/ui/Spinner";
import { PatientDetail, PatientFormValues } from "@/types";

function patientToForm(p: PatientDetail): PatientFormValues {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth ?? "",
    gender: (p.gender ?? "") as PatientFormValues["gender"],
    id_number: p.id_number ?? "",
    phone: p.phone ?? "",
    phone_secondary: p.phone_secondary ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    emergency_contact_name: p.emergency_contact_name ?? "",
    emergency_contact_phone: p.emergency_contact_phone ?? "",
    blood_type: p.blood_type ?? "",
    allergies: p.allergies ?? "",
    medical_conditions: p.medical_conditions ?? "",
    current_medications: p.current_medications ?? "",
    chief_complaint: p.chief_complaint ?? "",
    notes: p.notes ?? "",
  };
}

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient, isLoading } = usePatient(id);
  const update = useUpdatePatient(id);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Paciente no encontrado.
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/patients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={16} />
          {patient.full_name}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">
          Editar paciente
        </h1>
      </div>

      <div className="max-w-2xl rounded-xl bg-white p-8 shadow-sm border border-slate-100">
        <PatientForm
          defaultValues={patientToForm(patient)}
          onSubmit={(values) => update.mutate(values)}
          isPending={update.isPending}
          submitLabel="Guardar cambios"
          onCancel={() => window.history.back()}
        />
      </div>
    </div>
  );
}
