"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Plus, ClipboardList, Trash2 } from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import { usePatientPlans, useDeletePlan } from "@/hooks/useTreatments";
import {
  TreatmentPlan,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_COLORS,
  TreatmentPlanStatus,
} from "@/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";

function DeletePlanModal({
  plan,
  patientId,
  onClose,
}: {
  plan: TreatmentPlan;
  patientId: string;
  onClose: () => void;
}) {
  const deletePlan = useDeletePlan(patientId, onClose);
  return (
    <Modal open onClose={onClose} title="Eliminar plan de tratamiento" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          ¿Estás seguro de que deseas eliminar el plan{" "}
          <strong>"{plan.title}"</strong>? Esta acción es permanente y eliminará
          todos los procedimientos del plan.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            loading={deletePlan.isPending}
            onClick={() => deletePlan.mutate(plan.id)}
          >
            Eliminar plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PlanCard({
  plan,
  patientId,
  onDelete,
}: {
  plan: TreatmentPlan;
  patientId: string;
  onDelete: (plan: TreatmentPlan) => void;
}) {
  const total = plan.items.length;
  const done = plan.items.filter((i) => i.status === "completed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalPrice = plan.items.reduce((s, i) => s + (i.quoted_price ?? 0), 0);

  return (
    <div className="relative group rounded-xl bg-white shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
      <Link
        href={`/patients/${patientId}/treatments/${plan.id}`}
        className="block p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">{plan.title}</h3>
            {plan.diagnosis && (
              <p className="text-sm text-slate-500 truncate mt-0.5">{plan.diagnosis}</p>
            )}
          </div>
          <Badge
            label={PLAN_STATUS_LABELS[plan.status as TreatmentPlanStatus]}
            className={PLAN_STATUS_COLORS[plan.status as TreatmentPlanStatus]}
          />
        </div>

        {total > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{done}/{total} procedimientos</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{format(parseISO(plan.created_at), "d MMM yyyy", { locale: es })}</span>
          {totalPrice > 0 && (
            <span className="font-medium text-slate-600">
              C$ {totalPrice.toLocaleString("es-NI", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </Link>

      {/* Botón eliminar — visible al hacer hover */}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(plan); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Eliminar plan"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function PatientTreatmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: plans = [], isLoading } = usePatientPlans(id);
  const [planToDelete, setPlanToDelete] = useState<TreatmentPlan | null>(null);

  const active = plans.filter((p) => p.status === "active");
  const rest = plans.filter((p) => p.status !== "active");

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">
            Planes de Tratamiento
          </h1>
        </div>
        <Link href={`/patients/${id}/treatments/new`}>
          <Button>
            <Plus size={16} />
            Nuevo plan
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <ClipboardList size={40} strokeWidth={1.2} />
          <p className="text-sm">No hay planes de tratamiento registrados.</p>
          <Link href={`/patients/${id}/treatments/new`}>
            <Button size="sm">Crear primer plan</Button>
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Activos
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((p) => (
                  <PlanCard key={p.id} plan={p} patientId={id} onDelete={setPlanToDelete} />
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Historial
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {rest.map((p) => (
                  <PlanCard key={p.id} plan={p} patientId={id} onDelete={setPlanToDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {planToDelete && (
        <DeletePlanModal
          plan={planToDelete}
          patientId={id}
          onClose={() => setPlanToDelete(null)}
        />
      )}
    </div>
  );
}
