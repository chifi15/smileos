"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { differenceInYears, parseISO } from "date-fns";
import {
  UserPlus, Search, ChevronLeft, ChevronRight, Users,
  Trash2, X, UserCheck, UserX,
} from "lucide-react";
import { usePatientList, useDeletePatientPermanent, useReactivatePatient } from "@/hooks/usePatients";
import {
  REWARDS_LEVEL_LABELS,
  REWARDS_LEVEL_COLORS,
  RewardsLevel,
} from "@/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/utils";

interface PatientToDelete { id: string; name: string }

function DeletePatientModal({ patient, onClose }: { patient: PatientToDelete; onClose: () => void }) {
  const del = useDeletePatientPermanent();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Eliminar paciente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-2">
          ¿Eliminar permanentemente a <strong>{patient.name}</strong>?
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Esta acción no se puede deshacer. Si el paciente tiene citas, tratamientos o pagos vinculados, usa <strong>Reactivar</strong> o <strong>Desactivar</strong> en su perfil en su lugar.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => del.mutate(patient.id, { onSuccess: onClose })}
            disabled={del.isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {del.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const LEVEL_FILTER_OPTIONS = [
  { value: "", label: "Todos los niveles" },
  { value: "starter", label: "Starter" },
  { value: "bronze", label: "Bronce" },
  { value: "silver", label: "Plata" },
  { value: "gold", label: "Oro" },
  { value: "diamond", label: "Diamante" },
];

function age(dob: string | null): string {
  if (!dob) return "—";
  return `${differenceInYears(new Date(), parseISO(dob))} años`;
}

export default function PatientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [level, setLevel] = useState(searchParams.get("level") ?? "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1"));
  const [showInactive, setShowInactive] = useState(false);
  const [toDelete, setToDelete] = useState<PatientToDelete | null>(null);
  const reactivate = useReactivatePatient();

  // Sync URL params → local state on navigation
  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
    setLevel(searchParams.get("level") ?? "");
    setPage(parseInt(searchParams.get("page") ?? "1"));
  }, [searchParams]);

  // Debounced search: push to URL after 400ms idle
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (searchInput) p.set("q", searchInput);
      if (level) p.set("level", level);
      p.set("page", "1");
      router.replace(`${pathname}?${p.toString()}`);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = searchParams.get("q") ?? undefined;
  const levelFilter = searchParams.get("level") ?? undefined;

  const { data, isLoading } = usePatientList({
    search,
    level: levelFilter,
    page,
    per_page: 20,
    active_only: !showInactive,
  });

  const patients = data?.data ?? [];
  const meta = data?.meta;

  function goPage(n: number) {
    setPage(n);
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(n));
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Pacientes</h1>
          {meta && (
            <p className="text-sm text-slate-500">
              {meta.total} {showInactive ? "pacientes inactivos" : "pacientes activos"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Active / Inactive toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => { setShowInactive(false); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                !showInactive ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UserCheck size={13} /> Activos
            </button>
            <button
              onClick={() => { setShowInactive(true); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                showInactive ? "bg-slate-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UserX size={13} /> Inactivos
            </button>
          </div>
          {!showInactive && (
            <Link href="/patients/new">
              <Button>
                <UserPlus size={16} />
                Nuevo paciente
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className={cn(
              "h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            )}
          />
        </div>
        <div className="w-48">
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={LEVEL_FILTER_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <Users size={40} strokeWidth={1.2} />
            <p className="text-sm">
              {search
                ? "Sin resultados para la búsqueda."
                : showInactive
                ? "No hay pacientes inactivos."
                : "Aún no hay pacientes registrados."}
            </p>
            {!search && !showInactive && (
              <Link href="/patients/new">
                <Button size="sm">Registrar primer paciente</Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Paciente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Edad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Teléfono
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Rewards
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-blue-50/40",
                      showInactive && "opacity-75"
                    )}
                    onClick={() => router.push(`/patients/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          showInactive ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-600"
                        )}>
                          {p.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        <span className={cn("font-medium", showInactive ? "text-slate-500" : "text-slate-800")}>
                          {p.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{age(p.date_of_birth)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.phone ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.rewards_level ? (
                        <Badge
                          label={REWARDS_LEVEL_LABELS[p.rewards_level as RewardsLevel]}
                          className={REWARDS_LEVEL_COLORS[p.rewards_level as RewardsLevel]}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/patients/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-md px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          Ver
                        </Link>
                        {showInactive && (
                          <button
                            onClick={(e) => { e.stopPropagation(); reactivate.mutate(p.id); }}
                            disabled={reactivate.isPending}
                            className="rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-60"
                            title="Reactivar paciente"
                          >
                            Reactivar
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setToDelete({ id: p.id, name: p.full_name }); }}
                          className="rounded-md p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar paciente permanentemente"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {meta && meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  {(meta.page - 1) * meta.per_page + 1}–
                  {Math.min(meta.page * meta.per_page, meta.total)} de {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => goPage(page - 1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-slate-600">{page} / {meta.pages}</span>
                  <Button variant="secondary" size="sm" disabled={page === meta.pages} onClick={() => goPage(page + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toDelete && (
        <DeletePatientModal patient={toDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
