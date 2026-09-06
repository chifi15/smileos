"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useDashboardStats, useTodaySchedule, useMonthlyPatients, MonthlyPatientRow } from "@/hooks/useDashboard";
import { useAuditFeed } from "@/hooks/useAudit";
import { useAuthStore } from "@/stores/auth.store";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_TYPE_LABELS,
  REWARDS_LEVEL_LABELS,
  REWARDS_LEVEL_COLORS,
  RewardsLevel,
} from "@/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Clock,
  UserX,
  Users,
  ClipboardList,
  Star,
  RefreshCw,
  Activity,
  CalendarDays,
  UserCheck,
  X,
} from "lucide-react";

function greeting(name: string) {
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
  return `${saludo}, ${name.split(" ")[0]}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-slate-100 dark:border-gray-700 ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-200 dark:hover:border-gray-600 transition-all" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

type ModalMode = "atenciones" | "unicos";

function MonthlyPatientsModal({
  mode,
  rows,
  isLoading,
  onClose,
}: {
  mode: ModalMode;
  rows: MonthlyPatientRow[] | undefined;
  isLoading: boolean;
  onClose: () => void;
}) {
  const title = mode === "atenciones" ? "Atenciones del mes" : "Pacientes únicos del mes";

  const displayRows = useMemo(() => {
    if (!rows) return [];
    if (mode === "atenciones") return rows;
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = r.patient_id ?? r.patient_name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows, mode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-slate-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : displayRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-gray-500">
              No hay registros para este mes
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Paciente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Procedimiento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Doctor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                {displayRows.map((row) => (
                  <tr key={row.transaction_id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 whitespace-nowrap">
                      {format(parseISO(row.date), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {row.patient_id ? (
                        <Link href={`/patients/${row.patient_id}`} className="hover:text-blue-600 transition-colors">
                          {row.patient_name}
                        </Link>
                      ) : (
                        row.patient_name
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400">
                      {row.procedure_name ?? <span className="text-slate-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400">
                      {row.doctor_name ?? <span className="text-slate-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">
                      C$ {row.amount.toLocaleString("es-NI", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {displayRows.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-gray-700 text-xs text-slate-400 dark:text-gray-500 shrink-0">
            {displayRows.length} {mode === "atenciones" ? "atención(es)" : "paciente(s)"}
          </div>
        )}
      </div>
    </div>
  );
}

const RESOURCE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700",
  appointment: "bg-purple-100 text-purple-700",
  treatment_plan: "bg-indigo-100 text-indigo-700",
  treatment_item: "bg-cyan-100 text-cyan-700",
  odontogram: "bg-teal-100 text-teal-700",
  evolution: "bg-emerald-100 text-emerald-700",
  finance: "bg-green-100 text-green-700",
  reward: "bg-amber-100 text-amber-700",
  photo: "bg-pink-100 text-pink-700",
  settings: "bg-slate-100 text-slate-600",
  user: "bg-orange-100 text-orange-700",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useDashboardStats();
  const { data: schedule, isLoading: loadingSchedule } = useTodaySchedule();
  const { data: auditData } = useAuditFeed({ per_page: 6 });
  const [monthlyModal, setMonthlyModal] = useState<ModalMode | null>(null);
  const { data: monthlyRows, isLoading: loadingMonthly } = useMonthlyPatients();

  const today = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  const pending = stats
    ? stats.today.scheduled + stats.today.confirmed + stats.today.in_progress
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
            {user ? greeting(user.full_name) : "Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 capitalize">{todayCapitalized}</p>
        </div>
        <button
          onClick={() => refetchStats()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Today's stats */}
      {loadingStats ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Calendar}
              label="Citas hoy"
              value={stats.today.total}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completadas"
              value={stats.today.completed}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={Clock}
              label="Pendientes"
              value={pending}
              sub={`${stats.today.in_progress} en progreso`}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={UserX}
              label="No asistió"
              value={stats.today.no_show}
              color="bg-rose-50 text-rose-600"
            />
          </div>

          {/* Monthly stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={CalendarDays}
              label="Atenciones del mes"
              value={stats.monthly.total_citas_mes}
              sub="Ingresos registrados (con repetidos)"
              color="bg-violet-50 text-violet-600"
              onClick={() => setMonthlyModal("atenciones")}
            />
            <StatCard
              icon={UserCheck}
              label="Pacientes únicos del mes"
              value={stats.monthly.pacientes_unicos_mes}
              sub="Sin contar visitas repetidas"
              color="bg-teal-50 text-teal-600"
              onClick={() => setMonthlyModal("unicos")}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Today's schedule */}
            <div className="lg:col-span-2">
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
                  <h2 className="font-semibold text-slate-800 dark:text-white">Agenda de hoy</h2>
                  <span className="text-xs text-slate-400 dark:text-gray-500">
                    {schedule?.length ?? 0} citas
                  </span>
                </div>

                <div className="divide-y divide-slate-50 dark:divide-gray-700">
                  {loadingSchedule ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !schedule || schedule.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">
                      No hay citas para hoy
                    </div>
                  ) : (
                    schedule.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="w-12 shrink-0 text-center">
                          <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                            {item.scheduled_at_local}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">
                            {item.duration_minutes} min
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          {item.patient.id ? (
                            <Link
                              href={`/patients/${item.patient.id}`}
                              className="truncate text-sm font-medium text-slate-800 dark:text-white hover:text-blue-600 transition-colors"
                            >
                              {item.patient.full_name}
                            </Link>
                          ) : (
                            <span className="truncate text-sm font-medium text-slate-800 dark:text-white">
                              {item.patient.full_name}
                            </span>
                          )}
                          <p className="text-xs text-slate-500 dark:text-gray-400">
                            {APPOINTMENT_TYPE_LABELS[item.appointment_type]}
                            {item.reason && ` — ${item.reason}`}
                          </p>
                        </div>
                        <Badge
                          label={APPOINTMENT_STATUS_LABELS[item.status]}
                          className={APPOINTMENT_STATUS_COLORS[item.status]}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Patient stats */}
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Pacientes</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-gray-400">Activos</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{stats.patients.total_active}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-gray-400">Nuevos este mes</span>
                    <span className="font-semibold text-green-600">+{stats.patients.new_this_month}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-gray-400">Nuevos (7 días)</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{stats.last_7_days.new_patients}</span>
                  </div>
                </div>
              </div>

              {/* Treatment plans */}
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Planes de Tratamiento</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Activos", value: stats.treatment_plans.active, color: "text-blue-600" },
                    { label: "En espera", value: stats.treatment_plans.on_hold, color: "text-amber-600" },
                    { label: "Completados", value: stats.treatment_plans.completed, color: "text-green-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-gray-400">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smile Rewards distribution */}
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Smile Rewards</h3>
                </div>
                <div className="space-y-2">
                  {(Object.keys(REWARDS_LEVEL_LABELS) as RewardsLevel[]).map((level) => (
                    <div key={level} className="flex items-center justify-between">
                      <Badge
                        label={REWARDS_LEVEL_LABELS[level]}
                        className={REWARDS_LEVEL_COLORS[level]}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
                        {stats.smile_rewards.by_level[level]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700 flex justify-between text-xs text-slate-500 dark:text-gray-400">
                  <span>Puntos en circulación</span>
                  <span className="font-semibold text-slate-700 dark:text-gray-300">
                    {stats.smile_rewards.total_points_in_circulation.toLocaleString("es-NI")}
                  </span>
                </div>
              </div>

              {/* Recent activity */}
              {auditData && auditData.data.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Última actividad</h3>
                    </div>
                    <Link href="/actividad" className="text-xs text-blue-500 hover:underline">
                      Ver todo
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {auditData.data.map((entry) => {
                      const color = RESOURCE_COLORS[entry.resource_type] ?? "bg-slate-100 text-slate-600";
                      return (
                        <div key={entry.id} className="flex items-start gap-2">
                          <span className={`mt-0.5 shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
                            {entry.resource_type_label}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-700 dark:text-gray-300 leading-snug truncate">{entry.description}</p>
                            <p className="text-[10px] text-slate-400 dark:text-gray-500">
                              {format(parseISO(entry.created_at), "d MMM, HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">
          No se pudo cargar el dashboard. Intenta actualizar.
        </div>
      )}

      {monthlyModal && (
        <MonthlyPatientsModal
          mode={monthlyModal}
          rows={monthlyRows}
          isLoading={loadingMonthly}
          onClose={() => setMonthlyModal(null)}
        />
      )}
    </div>
  );
}
