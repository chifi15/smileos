"use client";

import Link from "next/link";
import { useDashboardStats, useTodaySchedule } from "@/hooks/useDashboard";
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
import { format } from "date-fns";
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
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useDashboardStats();
  const { data: schedule, isLoading: loadingSchedule } = useTodaySchedule();

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
          <h1 className="text-xl font-semibold text-slate-800">
            {user ? greeting(user.full_name) : "Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 capitalize">{todayCapitalized}</p>
        </div>
        <button
          onClick={() => refetchStats()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
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

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Today's schedule */}
            <div className="lg:col-span-2">
              <div className="rounded-xl bg-white shadow-sm border border-slate-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800">Agenda de hoy</h2>
                  <span className="text-xs text-slate-400">
                    {schedule?.length ?? 0} citas
                  </span>
                </div>

                <div className="divide-y divide-slate-50">
                  {loadingSchedule ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !schedule || schedule.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">
                      No hay citas para hoy
                    </div>
                  ) : (
                    schedule.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="w-12 shrink-0 text-center">
                          <span className="text-sm font-semibold text-slate-700">
                            {item.scheduled_at_local}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {item.duration_minutes} min
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/patients/${item.patient.id}`}
                            className="truncate text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors"
                          >
                            {item.patient.full_name}
                          </Link>
                          <p className="text-xs text-slate-500">
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
              <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Pacientes</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Activos</span>
                    <span className="font-semibold text-slate-800">{stats.patients.total_active}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Nuevos este mes</span>
                    <span className="font-semibold text-green-600">+{stats.patients.new_this_month}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Nuevos (7 días)</span>
                    <span className="font-semibold text-slate-800">{stats.last_7_days.new_patients}</span>
                  </div>
                </div>
              </div>

              {/* Treatment plans */}
              <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Planes de Tratamiento</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Activos", value: stats.treatment_plans.active, color: "text-blue-600" },
                    { label: "En espera", value: stats.treatment_plans.on_hold, color: "text-amber-600" },
                    { label: "Completados", value: stats.treatment_plans.completed, color: "text-green-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smile Rewards distribution */}
              <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Smile Rewards</h3>
                </div>
                <div className="space-y-2">
                  {(Object.keys(REWARDS_LEVEL_LABELS) as RewardsLevel[]).map((level) => (
                    <div key={level} className="flex items-center justify-between">
                      <Badge
                        label={REWARDS_LEVEL_LABELS[level]}
                        className={REWARDS_LEVEL_COLORS[level]}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {stats.smile_rewards.by_level[level]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Puntos en circulación</span>
                  <span className="font-semibold text-slate-700">
                    {stats.smile_rewards.total_points_in_circulation.toLocaleString("es-NI")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-sm text-slate-400">
          No se pudo cargar el dashboard. Intenta actualizar.
        </div>
      )}
    </div>
  );
}
