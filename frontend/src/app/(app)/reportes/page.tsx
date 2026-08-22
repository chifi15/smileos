"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Users,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { categoryLabel, categoryColor } from "@/types/costos";
import Spinner from "@/components/ui/Spinner";
import {
  useReportSummary,
  useMonthlyTrend,
  useTopProcedures,
  useTopProceduresQuoted,
  useTopExpenses,
  useDoctorReport,
  useTopPatients,
  useTopMaterials,
  useIncomeDetail,
  useExpenseDetail,
  useOpCostsBreakdown,
  useMaterialsByMonth,
} from "@/hooks/useReports";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const EXPENSE_LABELS: Record<string, string> = {
  laboratorio: "Laboratorio dental",
  insumos: "Insumos y materiales",
  renta: "Renta",
  servicios: "Servicios",
  salario: "Salario / Honorarios",
  otro_egreso: "Otro egreso",
};

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">{label}</p>
          <p
            className={`mt-1 text-lg font-bold leading-tight break-words ${
              positive === true
                ? "text-green-600 dark:text-green-400"
                : positive === false
                ? "text-red-500 dark:text-red-400"
                : "text-slate-800 dark:text-white"
            }`}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500 leading-tight">{sub}</p>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
      {children}
    </h2>
  );
}

function TableCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{title}</p>
      </div>
      {empty ? (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-gray-500">Sin datos</p>
      ) : (
        children
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function ReportesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterMonth, setFilterMonth] = useState<number | null>(now.getMonth() + 1);
  const [materialMonth, setMaterialMonth] = useState<number>(now.getMonth() + 1);

  const { data: summary, isLoading: loadingSummary } = useReportSummary(year, month);
  const { data: trend, isLoading: loadingTrend } = useMonthlyTrend(year);
  const { data: topProc } = useTopProcedures(year, filterMonth);
  const { data: topQuoted } = useTopProceduresQuoted(year, filterMonth);
  const { data: topExp } = useTopExpenses(year, filterMonth);
  const { data: doctors } = useDoctorReport(year, filterMonth);
  const { data: topPatients } = useTopPatients(year, filterMonth);
  const { data: topMaterials } = useTopMaterials(year, filterMonth);
  const { data: incomeDetail } = useIncomeDetail(year, filterMonth);
  const { data: expenseDetail } = useExpenseDetail(year, filterMonth);
  const { data: opCosts } = useOpCostsBreakdown(year, filterMonth);
  const { data: materialsByMonth } = useMaterialsByMonth(year);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Reportes Financieros</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Análisis de ingresos, gastos y rendimiento</p>
        </div>
        {/* Selector de mes para KPIs */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-700 dark:text-gray-200">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingSummary ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Facturación bruta"
            value={fmt(summary.ingresos_brutos)}
            sub={`${summary.count_ingresos} transacciones`}
            icon={DollarSign}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <KpiCard
            label="Total egresos"
            value={fmt(summary.egresos)}
            sub={`${summary.count_egresos} transacciones`}
            icon={TrendingDown}
            color="bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
            positive={false}
          />
          <KpiCard
            label="Costos operativos"
            value={fmt(summary.costos_operativos)}
            sub="Materiales por tratamiento"
            icon={Activity}
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          />
          <KpiCard
            label="Ingreso neto"
            value={fmt(summary.ingreso_neto)}
            sub="Bruto − egresos"
            icon={TrendingUp}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            positive={summary.ingreso_neto >= 0}
          />
          <KpiCard
            label="Utilidad neta"
            value={fmt(summary.utilidad_neta)}
            sub="− costos operativos"
            icon={TrendingUp}
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            positive={summary.utilidad_neta >= 0}
          />
          <KpiCard
            label="Margen"
            value={`${summary.margen_pct}%`}
            sub="Utilidad / facturación"
            icon={Activity}
            color={
              summary.margen_pct >= 40
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : summary.margen_pct >= 20
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
            }
            positive={summary.margen_pct >= 0}
          />
        </div>
      ) : null}

      {/* Tendencia anual */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Tendencia {year}</SectionTitle>
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-medium text-slate-600 dark:text-gray-300 w-10 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        {loadingTrend ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : trend ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `C$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {/* Filtro de mes para las tablas */}
      <div className="flex items-center gap-3">
        <SectionTitle>Detalle</SectionTitle>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-slate-500 dark:text-gray-400">Filtrar por mes:</label>
          <select
            value={filterMonth ?? ""}
            onChange={(e) => setFilterMonth(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-slate-700 dark:text-gray-200"
          >
            <option value="">Todo el año {year}</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 1: Top tratamientos realizados + Top cotizados */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TableCard title="Top tratamientos facturados" empty={!topProc?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Tratamiento</th>
                <th className="px-4 py-2 font-medium text-right">Veces</th>
                <th className="px-4 py-2 font-medium text-right">Facturado</th>
              </tr>
            </thead>
            <tbody>
              {topProc?.map((p, i) => (
                <tr key={p.procedure_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">{p.procedure_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{p.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{fmt(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Tratamientos más cotizados en planes" empty={!topQuoted?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Tratamiento</th>
                <th className="px-4 py-2 font-medium text-right">Cotizado</th>
                <th className="px-4 py-2 font-medium text-right">Total cotizado</th>
              </tr>
            </thead>
            <tbody>
              {topQuoted?.map((p, i) => (
                <tr key={p.procedure_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">{p.procedure_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{p.quoted}×</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">{fmt(p.total_cotizado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      {/* Row 2: Gastos por categoría + Por doctor */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TableCard title="Mayores gastos por categoría" empty={!topExp?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-right">Transacciones</th>
                <th className="px-4 py-2 font-medium text-right">% del total</th>
                <th className="px-4 py-2 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {topExp?.map((e) => (
                <tr key={e.category} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                    {EXPENSE_LABELS[e.category] ?? e.category}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{e.count}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-red-400 h-1.5 rounded-full"
                          style={{ width: `${Math.min(e.pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-500 dark:text-gray-400 w-10 text-right">{e.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-500 dark:text-red-400">{fmt(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Ingresos por doctor" empty={!doctors?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Doctor</th>
                <th className="px-4 py-2 font-medium text-right">Transacciones</th>
                <th className="px-4 py-2 font-medium text-right">Costos op.</th>
                <th className="px-4 py-2 font-medium text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {doctors?.map((d) => (
                <tr key={d.doctor_id ?? "sin"} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                        {d.doctor_name.charAt(0).toUpperCase()}
                      </div>
                      {d.doctor_name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{d.transacciones}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400">{fmt(d.costos_op)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{fmt(d.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      {/* Row 3: Top pacientes + Materiales más usados */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TableCard title="Top pacientes por facturación" empty={!topPatients?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-4 py-2 font-medium text-right">Pagos</th>
                <th className="px-4 py-2 font-medium text-right">Total pagado</th>
              </tr>
            </thead>
            <tbody>
              {topPatients?.map((p, i) => (
                <tr key={p.patient_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                        {p.patient_name.charAt(0).toUpperCase()}
                      </div>
                      {p.patient_name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{p.count}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{fmt(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Materiales más usados" empty={!topMaterials?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Material</th>
                <th className="px-4 py-2 font-medium text-right">Unidades</th>
                <th className="px-4 py-2 font-medium text-right">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {topMaterials?.map((m, i) => (
                <tr key={m.product_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <Package size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 dark:text-gray-200 truncate">{m.name}</p>
                        <span className={`inline-block mt-0.5 rounded px-1 py-0.5 text-[10px] leading-none ${categoryColor(m.category)}`}>
                          {categoryLabel(m.category)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">
                    {m.total_units % 1 === 0 ? m.total_units.toFixed(0) : m.total_units.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(m.total_cost)}</td>
                </tr>
              ))}
            </tbody>
            {topMaterials && topMaterials.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
                    Total gastado en materiales
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-600 dark:text-amber-400">
                    {fmt(topMaterials.reduce((sum, m) => sum + m.total_cost, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableCard>
      </div>

      {/* ── Materiales por mes ── */}
      {(() => {
        const group = materialsByMonth?.find(g => g.month === materialMonth) ?? null;
        return (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Materiales usados por mes</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-gray-400">Mes:</label>
                <select
                  value={materialMonth}
                  onChange={(e) => setMaterialMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-slate-700 dark:text-gray-200"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>
                      {m} {year}{materialsByMonth?.find(g => g.month === i + 1) ? "" : " —"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!group ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">
                Sin datos de materiales para {MONTHS[materialMonth - 1]} {year}
              </p>
            ) : (
              <>
                <div className="overflow-y-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                      <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                        <th className="px-3 py-1.5 font-medium">#</th>
                        <th className="px-3 py-1.5 font-medium">Material</th>
                        <th className="px-3 py-1.5 font-medium text-right">Precio unit.</th>
                        <th className="px-3 py-1.5 font-medium text-right">Unidades</th>
                        <th className="px-3 py-1.5 font-medium text-right">Costo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.materials.map((m, i) => (
                        <tr key={m.product_id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-3 py-1 text-slate-400 dark:text-gray-500">{i + 1}</td>
                          <td className="px-3 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Package size={11} className="shrink-0 text-amber-500 dark:text-amber-400" />
                              <span className="font-medium text-slate-700 dark:text-gray-200 truncate">{m.name}</span>
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] leading-none ${categoryColor(m.category)}`}>
                                {categoryLabel(m.category)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1 text-right text-slate-400 dark:text-gray-500">{fmt(m.unit_price)}</td>
                          <td className="px-3 py-1 text-right text-slate-600 dark:text-gray-300">
                            {m.total_units % 1 === 0 ? m.total_units.toFixed(0) : m.total_units.toFixed(2)}
                          </td>
                          <td className="px-3 py-1 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(m.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40 flex justify-between px-3 py-1.5 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-gray-300">Total {MONTHS[materialMonth - 1]}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{fmt(group.total_cost)}</span>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Detalle: Ingresos + Egresos ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ingresos */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
              Detalle de ingresos{incomeDetail && incomeDetail.length === 100 ? " (últimos 100)" : ""}
            </p>
          </div>
          {!incomeDetail?.length ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">Sin datos</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                    <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                      <th className="px-3 py-1.5 font-medium">Fecha</th>
                      <th className="px-3 py-1.5 font-medium">Paciente</th>
                      <th className="px-3 py-1.5 font-medium">Procedimiento</th>
                      <th className="px-3 py-1.5 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeDetail.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-3 py-1 text-slate-500 dark:text-gray-400 whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-1 text-slate-700 dark:text-gray-200 truncate max-w-[120px]">{t.patient_name ?? "—"}</td>
                        <td className="px-3 py-1 text-slate-600 dark:text-gray-300 truncate max-w-[120px]">{t.procedure_name ?? t.description}</td>
                        <td className="px-3 py-1 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{fmt(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40 flex justify-between px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-600 dark:text-gray-300">Total facturación bruta</span>
                <span className="font-bold text-green-600 dark:text-green-400">{fmt(incomeDetail.reduce((s, t) => s + t.amount, 0))}</span>
              </div>
            </>
          )}
        </div>

        {/* Egresos */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
              Detalle de egresos{expenseDetail && expenseDetail.length === 100 ? " (últimos 100)" : ""}
            </p>
          </div>
          {!expenseDetail?.length ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">Sin datos</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                    <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                      <th className="px-3 py-1.5 font-medium">Fecha</th>
                      <th className="px-3 py-1.5 font-medium">Categoría</th>
                      <th className="px-3 py-1.5 font-medium">Descripción</th>
                      <th className="px-3 py-1.5 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseDetail.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-3 py-1 text-slate-500 dark:text-gray-400 whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-1 text-slate-600 dark:text-gray-300 whitespace-nowrap">{t.category_label}</td>
                        <td className="px-3 py-1 text-slate-700 dark:text-gray-200 truncate max-w-[140px]">{t.description}</td>
                        <td className="px-3 py-1 text-right font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">{fmt(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40 flex justify-between px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-600 dark:text-gray-300">Total egresos</span>
                <span className="font-bold text-red-500 dark:text-red-400">{fmt(expenseDetail.reduce((s, t) => s + t.amount, 0))}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Detalle: Costos operativos + Utilidad mensual ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TableCard title="Costos operativos por procedimiento" empty={!opCosts?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Procedimiento</th>
                <th className="px-4 py-2 font-medium text-right">Veces</th>
                <th className="px-4 py-2 font-medium text-right">Prom. / vez</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {opCosts?.map((r) => (
                <tr key={r.procedure_id ?? "none"} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">{r.procedure_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{r.count}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">{fmt(r.avg_op_cost)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(r.total_op_cost)}</td>
                </tr>
              ))}
            </tbody>
            {opCosts && opCosts.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
                    Total costos operativos
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-amber-600 dark:text-amber-400">
                    {fmt(opCosts.reduce((s, r) => s + r.total_op_cost, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableCard>

        <TableCard title={`Utilidad mensual ${year}`} empty={!trend?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Mes</th>
                <th className="px-4 py-2 font-medium text-right">Ingresos</th>
                <th className="px-4 py-2 font-medium text-right">Egresos</th>
                <th className="px-4 py-2 font-medium text-right">Costos op.</th>
                <th className="px-4 py-2 font-medium text-right">Utilidad real</th>
              </tr>
            </thead>
            <tbody>
              {trend?.map((r) => (
                <tr key={r.month} className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium">{r.mes}</td>
                  <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400">{fmt(r.ingresos)}</td>
                  <td className="px-4 py-2.5 text-right text-red-500 dark:text-red-400">{fmt(r.egresos)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400">{r.costos_op > 0 ? fmt(r.costos_op) : <span className="text-slate-300 dark:text-gray-600">—</span>}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.utilidad >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmt(r.utilidad)}
                  </td>
                </tr>
              ))}
            </tbody>
            {trend && trend.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40">
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-gray-300">Total año</td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-600 dark:text-green-400">
                    {fmt(trend.reduce((s, r) => s + r.ingresos, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-500 dark:text-red-400">
                    {fmt(trend.reduce((s, r) => s + r.egresos, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                    {fmt(trend.reduce((s, r) => s + r.costos_op, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                    {fmt(trend.reduce((s, r) => s + r.utilidad, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableCard>
      </div>
    </div>
  );
}
