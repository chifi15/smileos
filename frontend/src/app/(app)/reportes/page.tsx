"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import Link from "next/link";
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
  Pencil,
  Check,
  X,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  ShoppingCart,
  Boxes,
} from "lucide-react";
import { categoryLabel, categoryColor } from "@/types/costos";
import Spinner from "@/components/ui/Spinner";
import FinanceSummaryPanel from "@/components/finance/FinanceSummaryPanel";
import DoctorAccountCard from "@/components/reports/DoctorAccountCard";
import BudgetVsActualCard from "@/components/reports/BudgetVsActualCard";
import DrilldownModal, { type DrilldownSelection } from "@/components/reports/DrilldownModal";
import PlanGate from "@/components/ui/PlanGate";
import { useUiPreferences, useUpdateUiPreference } from "@/hooks/useSettings";
import { useFixedCosts, useCostProducts } from "@/hooks/useCostos";
import { useIncomeByPatient } from "@/hooks/useFinances";
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
  useMaterialUsage,
  MaterialUsageRow,
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

// El stock está en unidades de presentación (ml, g…) y unit_price es el costo por porción:
// valor = (stock ÷ tamaño de porción) × costo por porción.
function productStockValue(p: { stock_qty?: number | null; unit_price: number; portion_qty?: number | null }) {
  const qty = p.stock_qty ?? 0;
  const portions = p.portion_qty ? qty / p.portion_qty : qty;
  return portions * p.unit_price;
}

function fmt(n: number) {
  return `C$${n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
      {children}
    </h2>
  );
}

function EditableTitle({ prefKey, defaultValue, className }: {
  prefKey: string;
  defaultValue: string;
  className?: string;
}) {
  const { data: prefs } = useUiPreferences();
  const update = useUpdateUiPreference();
  const saved = prefs?.[prefKey];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(saved ?? defaultValue); inputRef.current?.focus(); } }, [editing]);

  const save = useCallback(() => {
    const trimmed = draft.trim() || defaultValue;
    update.mutate({ [prefKey]: trimmed });
    setEditing(false);
  }, [draft, defaultValue, prefKey]);

  const displayed = saved ?? defaultValue;

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className={`${className} border-b border-blue-400 outline-none bg-transparent w-full`}
        />
        <button onClick={save} className="shrink-0 text-blue-500 hover:text-blue-700">
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <span className={`flex items-center gap-1.5 group ${className}`}>
      {displayed}
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"
        title="Editar nombre"
      >
        <Pencil size={12} />
      </button>
    </span>
  );
}

function TableCard({
  title,
  prefKey,
  children,
  empty,
}: {
  title: string;
  prefKey?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
        {prefKey ? (
          <EditableTitle prefKey={prefKey} defaultValue={title} className="text-sm font-semibold text-slate-700 dark:text-gray-200" />
        ) : (
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{title}</p>
        )}
      </div>
      {empty ? (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-gray-500">Sin datos</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
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

interface SelectedMaterial {
  productId: string;
  name: string;
  year: number;
  month: number | null;
}

interface PatientGroup {
  patient_id: string | null;
  patient_name: string;
  total_units: number;
  usages: MaterialUsageRow[];
}

function fmtUnits(n: number) {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-NI", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MaterialUsageModal({
  selected,
  onClose,
}: {
  selected: SelectedMaterial;
  onClose: () => void;
}) {
  const { data, isLoading } = useMaterialUsage(selected.productId, selected.year, selected.month);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());

  const patientGroups = useMemo<PatientGroup[]>(() => {
    if (!data?.usages.length) return [];
    const map = new Map<string, PatientGroup>();
    for (const u of data.usages) {
      const key = u.patient_id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, { patient_id: u.patient_id, patient_name: u.patient_name ?? "Sin paciente", total_units: 0, usages: [] });
      }
      const g = map.get(key)!;
      g.total_units += u.units_used;
      g.usages.push(u);
    }
    return Array.from(map.values()).sort((a, b) => b.total_units - a.total_units);
  }, [data]);

  const activeGroup = drillId != null
    ? patientGroups.find(g => (g.patient_id ?? "__none__") === drillId) ?? null
    : null;

  function toggleTx(id: string) {
    setExpandedTx(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const period = selected.month
    ? `${MONTHS[selected.month - 1]} ${selected.year}`
    : `año ${selected.year}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
          {activeGroup && (
            <button
              onClick={() => { setDrillId(null); setExpandedTx(new Set()); }}
              className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={13} /> Pacientes
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <Package size={12} />
              </div>
              <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{selected.name}</span>
              {data && (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor(data.category)}`}>
                  {categoryLabel(data.category)}
                </span>
              )}
            </div>
            {activeGroup ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                {activeGroup.patient_name} · {activeGroup.usages.length} transacciones · {fmtUnits(activeGroup.total_units)} unidades
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{period}</p>
            )}
          </div>
          {activeGroup?.patient_id && (
            <Link
              href={`/patients/${activeGroup.patient_id}`}
              onClick={onClose}
              className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              Ver perfil <ExternalLink size={11} />
            </Link>
          )}
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !data || data.usages.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400 dark:text-gray-500">
              No se encontraron usos de este material en el período seleccionado.
            </p>
          ) : activeGroup ? (
            /* ── Nivel 2: transacciones del paciente ── */
            <div className="divide-y divide-slate-50 dark:divide-gray-700/50">
              {activeGroup.usages.map((row) => {
                const open = expandedTx.has(row.transaction_id);
                return (
                  <div key={row.transaction_id}>
                    <div className="flex items-center gap-3 px-4 py-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium text-slate-700 dark:text-gray-200 whitespace-nowrap">
                            {fmtDate(row.date)}
                          </span>
                          {row.procedure_name && (
                            <span className="text-slate-600 dark:text-gray-300 truncate">{row.procedure_name}</span>
                          )}
                          {row.doctor_name && (
                            <span className="text-slate-400 dark:text-gray-500 truncate">{row.doctor_name}</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {fmtUnits(row.units_used)} u. de {selected.name}
                          </span>
                          {row.all_materials.length > 1 && (
                            <button
                              onClick={() => toggleTx(row.transaction_id)}
                              className="flex items-center gap-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
                            >
                              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              <span className="text-[10px]">
                                {open ? "Ocultar" : `Ver todos (${row.all_materials.length} materiales)`}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/patients/${activeGroup.patient_id}`}
                        onClick={onClose}
                        className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 transition-colors"
                        title="Ver transacción en el perfil del paciente"
                      >
                        Ir <ExternalLink size={10} />
                      </Link>
                    </div>

                    {/* Expanded materials list */}
                    {open && row.all_materials.length > 0 && (
                      <div className="mx-4 mb-3 rounded-lg bg-slate-50 dark:bg-gray-700/40 border border-slate-100 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                              <th className="px-3 py-1.5 font-medium">Material</th>
                              <th className="px-3 py-1.5 font-medium text-right">Unidades</th>
                              <th className="px-3 py-1.5 font-medium text-right">Precio unit.</th>
                              <th className="px-3 py-1.5 font-medium text-right">Costo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.all_materials.map((mat, idx) => (
                              <tr
                                key={idx}
                                className={mat.is_selected ? "bg-amber-50 dark:bg-amber-900/20" : ""}
                              >
                                <td className={`px-3 py-1 font-medium ${mat.is_selected ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-gray-300"}`}>
                                  {mat.is_selected && <span className="mr-1 text-amber-500">★</span>}
                                  {mat.name}
                                </td>
                                <td className="px-3 py-1 text-right text-slate-600 dark:text-gray-300">{fmtUnits(mat.units)}</td>
                                <td className="px-3 py-1 text-right text-slate-400 dark:text-gray-500">{fmt(mat.unit_price)}</td>
                                <td className="px-3 py-1 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(mat.total_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Nivel 1: lista de pacientes ── */
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Paciente</th>
                  <th className="px-4 py-2.5 font-medium text-right">Usos</th>
                  <th className="px-4 py-2.5 font-medium text-right">Unidades</th>
                  <th className="px-4 py-2.5 font-medium text-right">Costo total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                {patientGroups.map((g, i) => {
                  const cost = g.total_units * (data?.unit_price ?? 0);
                  return (
                    <tr
                      key={g.patient_id ?? "__none__"}
                      onClick={() => setDrillId(g.patient_id ?? "__none__")}
                      className="cursor-pointer hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 dark:text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                            {g.patient_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700 dark:text-gray-200">{g.patient_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300">{g.usages.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{fmtUnits(g.total_units)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{fmt(cost)}</td>
                      <td className="px-4 py-3 text-right text-slate-300 dark:text-gray-600">›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        {data && data.usages.length > 0 && !activeGroup && (
          <div className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/40 px-4 py-2.5 flex flex-wrap gap-4 text-xs">
            <span className="text-slate-500 dark:text-gray-400">
              {patientGroups.length} pacientes
            </span>
            <span className="text-slate-500 dark:text-gray-400">
              {data.usages.length} transacciones
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              {fmtUnits(data.usages.reduce((s, r) => s + r.units_used, 0))} unidades totales
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              {fmt(data.usages.reduce((s, r) => s + r.units_used, 0) * data.unit_price)} costo total
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterMonth, setFilterMonth] = useState<number | null>(now.getMonth() + 1);
  const [materialMonth, setMaterialMonth] = useState<number>(now.getMonth() + 1);
  const [selectedMaterial, setSelectedMaterial] = useState<SelectedMaterial | null>(null);
  const [drill, setDrill] = useState<DrilldownSelection | null>(null);
  const [showBreakEven, setShowBreakEven] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<"all" | "covered" | "uncovered">("all");
  const [infoCard, setInfoCard] = useState<"ticket" | "flujo" | "stock" | null>(null);
  const openDrill = (kind: DrilldownSelection["kind"], key: string, title: string) =>
    setDrill({ kind, key, title, year, month: filterMonth });

  const { data: summary, isLoading: loadingSummary } = useReportSummary(year, month);
  const { data: trend, isLoading: loadingTrend } = useMonthlyTrend(year);
  const { data: fixedCosts } = useFixedCosts();
  const { data: allProducts = [] } = useCostProducts();
  const { data: incomeByPatient = [] } = useIncomeByPatient(year, month);
  const { data: topProc } = useTopProcedures(year, filterMonth);
  const { data: topQuoted } = useTopProceduresQuoted(year, filterMonth);
  const { data: topExp } = useTopExpenses(year, filterMonth);
  const { data: topExpMonth } = useTopExpenses(year, month);
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
    <PlanGate feature="Reportes financieros">
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-screen-2xl">
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
        <>
        <FinanceSummaryPanel
          ingresos={summary.ingresos_brutos}
          egresos={summary.egresos}
          egresosCubiertos={summary.egresos_cubiertos ?? 0}
          costosOp={summary.costos_operativos}
          countIngresos={summary.count_ingresos}
          countEgresos={summary.count_egresos}
          onUtilityClick={() => setInfoCard("flujo")}
          breakdown={topExpMonth?.map((e) => ({ key: e.category, label: e.category_label, total: e.total, covered: !!e.covered }))}
        />

        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 leading-snug">
          <p className="font-semibold mb-1">Recordatorio: el material guardado también es dinero</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Comprar mucho material baja tu <strong>dinero real</strong> ese mes, pero no tu utilidad: el material cuenta cuando lo usas en un tratamiento.</li>
            <li>El material en el estante (Capital en stock) <strong>no es efectivo</strong>. Si se vence, se daña o se pierde, ese dinero se pierde.</li>
            <li>Cuando pase, regístralo en Costos → Productos → Ajustar stock → <strong>Dar de baja</strong>. Descuenta el stock y registra la pérdida como egreso, para que se vea en la utilidad.</li>
          </ul>
        </div>
        </>
      ) : null}

      {/* ── Métricas Clave ── */}
      {summary && (() => {
        const totalFixedCosts = fixedCosts?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
        const uniquePatients = incomeByPatient.length;
        const avgTicket = uniquePatients > 0 ? summary.ingresos_brutos / uniquePatients : 0;
        const avgMargin = summary.count_ingresos > 0
          ? (summary.ingresos_brutos - summary.costos_operativos) / summary.count_ingresos
          : 0;
        const breakEven = avgMargin > 0 ? Math.ceil(totalFixedCosts / avgMargin) : null;
        const stockValue = allProducts.reduce((s, p) => s + productStockValue(p), 0);
        
        return (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Métricas clave del mes</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

              {/* Ticket promedio */}
              <div
                onClick={() => setInfoCard("ticket")}
                title="Clic para ver qué significa y de dónde sale"
                className="cursor-pointer rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/40 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <ShoppingCart size={15} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wide">Ticket promedio / paciente</span>
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500">ⓘ ver detalle</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {uniquePatients > 0 ? fmt(avgTicket) : "—"}
                </p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                  {uniquePatients > 0
                    ? `Basado en ${uniquePatients} paciente${uniquePatients !== 1 ? "s" : ""} este mes`
                    : "Sin ingresos con paciente asignado"}
                </p>
              </div>

              {/* Punto de equilibrio */}
              <div
                onClick={() => setShowBreakEven(true)}
                title="Clic para ver qué significa y de dónde sale"
                className="cursor-pointer rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/40 p-4 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Target size={15} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wide">Punto de equilibrio</span>
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500">ⓘ ver detalle</span>
                </div>
                {breakEven !== null ? (
                  <>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {breakEven} tratamiento{breakEven !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                      {summary.count_ingresos >= breakEven
                        ? <span className="text-green-600 dark:text-green-400 font-medium">✓ Superado este mes ({summary.count_ingresos} realizados)</span>
                        : `Llevas ${summary.count_ingresos} de ${breakEven} — faltan ${breakEven - summary.count_ingresos}`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-400 dark:text-gray-500">—</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                      {totalFixedCosts === 0
                        ? "Configura costos fijos en Costos → Costos Fijos"
                        : "Sin margen por tratamiento este mes"}
                    </p>
                  </>
                )}
              </div>

              {/* Stock inmovilizado */}
              <div
                onClick={() => setInfoCard("stock")}
                title="Clic para ver qué significa y de dónde sale"
                className="cursor-pointer rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/40 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Boxes size={15} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wide">Capital en stock</span>
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500">ⓘ ver detalle</span>
                </div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                  {fmt(stockValue)}
                </p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                  Dinero inmovilizado en productos — no está disponible como efectivo
                </p>
              </div>

            </div>
          </div>
        );
      })()}

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
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad" fill="#3b82f6" radius={[3, 3, 0, 0]} />
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
                <tr key={p.procedure_id} onClick={() => openDrill("treatment", p.procedure_id, p.procedure_name)} className="cursor-pointer border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">{p.procedure_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-300">{p.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{fmt(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Tratamientos más frecuentes" empty={!topQuoted?.length}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-gray-500 border-b border-slate-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Tratamiento</th>
                <th className="px-4 py-2 font-medium text-right">Veces</th>
                <th className="px-4 py-2 font-medium text-right">Total cobrado</th>
              </tr>
            </thead>
            <tbody>
              {topQuoted?.map((p, i) => (
                <tr key={p.procedure_id} onClick={() => openDrill("treatment", p.procedure_id, p.procedure_name)} className="cursor-pointer border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
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
          {(() => {
            const coveredTotal = topExp?.filter((e) => e.covered).reduce((s, e) => s + e.total, 0) ?? 0;
            const uncoveredTotal = topExp?.filter((e) => !e.covered).reduce((s, e) => s + e.total, 0) ?? 0;
            const opts: { key: typeof expenseFilter; label: string; total: number }[] = [
              { key: "all", label: "Todos", total: coveredTotal + uncoveredTotal },
              { key: "covered", label: "Ya cubiertos", total: coveredTotal },
              { key: "uncovered", label: "No cubiertos", total: uncoveredTotal },
            ];
            return (
              <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-slate-100 dark:border-gray-700">
                {opts.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setExpenseFilter(o.key)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      expenseFilter === o.key
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {o.label}: {fmt(o.total)}
                  </button>
                ))}
                <p className="basis-full text-[10px] text-slate-400 dark:text-gray-500">
                  “Ya cubiertos” no se restan de la utilidad porque ya están en honorarios, costos fijos o materiales. “No cubiertos” sí se restan.
                </p>
              </div>
            );
          })()}
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
              {topExp?.filter((e) => expenseFilter === "all" || (expenseFilter === "covered" ? e.covered : !e.covered)).map((e) => (
                <tr key={e.category} onClick={() => openDrill("expense", e.category, e.category_label)} className="cursor-pointer border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-200">
                    {e.category_label}
                    {e.covered && (
                      <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400">Ya cubierta</span>
                    )}
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
                <tr key={d.doctor_id ?? "sin"} onClick={() => openDrill("doctor", d.doctor_id ?? "none", d.doctor_name)} className="cursor-pointer border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
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

      <DoctorAccountCard year={year} month={filterMonth} />

      <BudgetVsActualCard year={year} month={filterMonth} />

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
                <tr key={p.patient_id} onClick={() => openDrill("patient", p.patient_id, p.patient_name)} className="cursor-pointer border-b border-slate-50 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
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

        <TableCard title="Materiales principales" prefKey="report-title-top-materials" empty={!topMaterials?.length}>
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
                <tr
                  key={m.product_id}
                  onClick={() => setSelectedMaterial({ productId: m.product_id, name: m.name, year, month: filterMonth })}
                  className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors cursor-pointer"
                >
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
              <EditableTitle prefKey="report-title-materials-by-month" defaultValue="Consumo mensual de materiales" className="text-sm font-semibold text-slate-700 dark:text-gray-200" />
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
                        <tr
                          key={m.product_id}
                          onClick={() => setSelectedMaterial({ productId: m.product_id, name: m.name, year, month: materialMonth })}
                          className="border-b border-slate-50 dark:border-gray-700/50 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors cursor-pointer"
                        >
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

      {selectedMaterial && (
        <MaterialUsageModal
          selected={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
        />
      )}

      {showBreakEven && summary && (() => {
        const items = fixedCosts?.items ?? [];
        const totalFixed = items.reduce((s, i) => s + i.amount, 0);
        const n = summary.count_ingresos;
        const margin = n > 0 ? (summary.ingresos_brutos - summary.costos_operativos) / n : 0;
        const be = margin > 0 ? Math.ceil(totalFixed / margin) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBreakEven(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                <Target size={16} className="text-amber-600 dark:text-amber-400" />
                <p className="flex-1 font-semibold text-sm text-slate-800 dark:text-white">Punto de equilibrio — {MONTHS[month - 1]} {year}</p>
                <button onClick={() => setShowBreakEven(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700">
                  <X size={15} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-4 text-xs text-slate-600 dark:text-gray-300">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Qué significa?</p>
                  <p>Es la cantidad de tratamientos que la clínica necesita hacer en el mes para cubrir todos sus costos fijos. Antes de llegar a ese número se trabaja para pagar los gastos fijos; a partir de ahí, cada tratamiento adicional ya deja ganancia.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Cómo se calcula?</p>
                  <p className="rounded-lg bg-slate-50 dark:bg-gray-700/40 border border-slate-100 dark:border-gray-700 p-2.5 font-medium">
                    Costos fijos del mes ÷ ganancia promedio por tratamiento
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">1. Costos fijos (Costos → Costos Fijos)</p>
                  {items.length === 0 ? (
                    <p className="text-slate-400">No has configurado costos fijos.</p>
                  ) : (
                    <table className="w-full">
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id} className="border-b border-slate-50 dark:border-gray-700/50">
                            <td className="py-1">{i.name}</td>
                            <td className="py-1 text-right">{fmt(i.amount)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold text-slate-700 dark:text-gray-200">
                          <td className="pt-1.5">Total costos fijos</td>
                          <td className="pt-1.5 text-right">{fmt(totalFixed)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">2. Ganancia promedio por tratamiento (de las finanzas del mes)</p>
                  <table className="w-full">
                    <tbody>
                      <tr><td className="py-0.5">Ingresos del mes</td><td className="py-0.5 text-right text-green-600 dark:text-green-400">{fmt(summary.ingresos_brutos)}</td></tr>
                      <tr><td className="py-0.5">− Costos operativos (materiales y honorarios de cada tratamiento)</td><td className="py-0.5 text-right text-amber-600 dark:text-amber-400">{fmt(summary.costos_operativos)}</td></tr>
                      <tr><td className="py-0.5">÷ Ingresos registrados</td><td className="py-0.5 text-right">{n}</td></tr>
                      <tr className="font-semibold text-slate-700 dark:text-gray-200"><td className="pt-1.5">Ganancia promedio por tratamiento</td><td className="pt-1.5 text-right">{fmt(margin)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3">
                  {be !== null ? (
                    <>
                      <p className="font-semibold text-slate-700 dark:text-gray-200">
                        {fmt(totalFixed)} ÷ {fmt(margin)} = {be} tratamiento{be !== 1 ? "s" : ""}
                      </p>
                      <p className="mt-1">
                        {n >= be
                          ? `Este mes llevas ${n}: ya cubriste tus costos fijos.`
                          : `Este mes llevas ${n}: te faltan ${be - n} para cubrir tus costos fijos.`}
                      </p>
                    </>
                  ) : (
                    <p>{totalFixed === 0 ? "Configura tus costos fijos para poder calcularlo." : "Este mes no hay ganancia por tratamiento, por eso no se puede calcular."}</p>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-3">
                  <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Se toman en cuenta los egresos (facturas, laboratorio, limpieza, seguridad, pagos)?</p>
                  <p className="mb-1.5">
                    <strong>No directamente.</strong> Los egresos que registras en Finanzas ({fmt(summary.egresos)} este mes) no entran en esta cuenta; sirven para controlar el gasto real. El cálculo solo usa dos cosas:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Los <strong>costos fijos</strong> que configuraste en Costos → Costos Fijos (lo que pongas ahí, como renta, limpieza o seguridad, sí cuenta).</li>
                    <li>El <strong>costo operativo de cada tratamiento</strong> (materiales + honorarios del doctor + parte de costos fijos), que sale de la plantilla del tratamiento en Costos, no de lo que pagaste realmente. Por eso el pago al doctor y los materiales sí están incluidos, pero como estimación de la plantilla.</li>
                  </ul>
                  <p className="mt-1.5">
                    Los pagos reales (facturas de depósitos, laboratorio, limpieza, seguridad, doctor, asistente) no se usan en este cálculo. Si alguno de esos gastos no está en tus costos fijos ni en los tratamientos, el punto de equilibrio real es mayor al mostrado. En la Utilidad neta y el Flujo libre, los egresos de categorías marcadas “Ya cubierta” (Finanzas → Categorías de egreso) no se restan, para no contarlos dos veces.
                  </p>
                  <p className="mt-1.5">
                    Además, el costo operativo ya incluye una parte de los costos fijos, así que estos se restan una vez en la ganancia por tratamiento y otra vez en el numerador; esto hace que el número sea algo más alto de lo necesario.
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-gray-500">
                  Es una estimación: cada ingreso registrado en Finanzas cuenta como un tratamiento y se usa el promedio del mes, así que cambia si cambia tu mezcla de tratamientos.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {infoCard && summary && (() => {
        const close = () => setInfoCard(null);
        const uniquePatients = incomeByPatient.length;
        const avgTicket = uniquePatients > 0 ? summary.ingresos_brutos / uniquePatients : 0;
        const stockRows = allProducts
          .map((p) => ({ id: p.id, name: p.name, qty: p.stock_qty ?? 0, price: p.unit_price, value: productStockValue(p) }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value);
        const stockValue = allProducts.reduce((s, p) => s + productStockValue(p), 0);
        const title = infoCard === "ticket" ? "Ticket promedio por paciente" : infoCard === "flujo" ? "Utilidad del mes" : "Capital en stock";
        const Row = ({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) => (
          <tr className={strong ? "font-semibold text-slate-700 dark:text-gray-200" : ""}>
            <td className={strong ? "pt-1.5" : "py-0.5"}>{label}</td>
            <td className={`${strong ? "pt-1.5" : "py-0.5"} text-right ${color ?? ""}`}>{value}</td>
          </tr>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                <p className="flex-1 font-semibold text-sm text-slate-800 dark:text-white">{title} — {MONTHS[month - 1]} {year}</p>
                <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700"><X size={15} /></button>
              </div>
              <div className="overflow-y-auto p-4 space-y-4 text-xs text-slate-600 dark:text-gray-300">
                {infoCard === "ticket" && (
                  <>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Qué significa?</p>
                      <p>Cuánto factura en promedio la clínica por cada paciente que pagó este mes. Sirve para saber el valor típico de un paciente.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿De dónde sale?</p>
                      <table className="w-full"><tbody>
                        <Row label="Ingresos del mes (Finanzas)" value={fmt(summary.ingresos_brutos)} color="text-green-600 dark:text-green-400" />
                        <Row label="÷ Pacientes distintos con ingresos este mes" value={String(uniquePatients)} />
                        <Row label="Ticket promedio" value={uniquePatients > 0 ? fmt(avgTicket) : "—"} strong />
                      </tbody></table>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-gray-500">Los ingresos sin paciente asignado suman al total pero no cuentan como paciente, por lo que pueden subir un poco el promedio.</p>
                  </>
                )}
                {infoCard === "flujo" && (
                  <>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Qué significa?</p>
                      <p>Lo que ganaste este mes por tus tratamientos: ingresos menos el costo de cada tratamiento y menos los egresos que no estaban ya incluidos en ese costo.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿De dónde sale?</p>
                      <table className="w-full"><tbody>
                        <Row label="Ingresos del mes (Finanzas)" value={fmt(summary.ingresos_brutos)} color="text-green-600 dark:text-green-400" />
                        <Row label="Egresos registrados en Finanzas (total)" value={fmt(summary.egresos)} color="text-slate-500 dark:text-gray-400" />
                        <Row label="   · de ellos, categorías “ya cubiertas” (no se restan)" value={fmt(summary.egresos_cubiertos ?? 0)} color="text-slate-400 dark:text-gray-500" />
                        <Row label="− Egresos que sí se restan" value={fmt(summary.egresos - (summary.egresos_cubiertos ?? 0))} color="text-red-500 dark:text-red-400" />
                        <Row label="− Costos operativos de los tratamientos (materiales, honorarios, parte de costos fijos)" value={fmt(summary.costos_operativos)} color="text-amber-600 dark:text-amber-400" />
                        <Row label="Utilidad" value={fmt(summary.utilidad_neta)} strong />
                      </tbody></table>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-gray-500">
                      Para no contar un gasto dos veces, en Finanzas → Categorías de egreso marca como “Ya cubierta” las categorías que ya están en honorarios, costos fijos o materiales (luz, doctor, asistente, limpieza, materiales…). Se siguen registrando con su monto y fecha exactos, pero no se restan aquí. Las categorías sin marcar sí se restan. Tampoco es dinero en caja: no distingue pagos pendientes ni cobros por recibir.
                    </p>
                  </>
                )}
                {infoCard === "stock" && (
                  <>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿Qué significa?</p>
                      <p>Dinero que tienes guardado en productos y materiales en inventario. No está disponible como efectivo hasta que se usen.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-gray-200 mb-1">¿De dónde sale? (Costos → Productos)</p>
                      <p className="mb-1.5">Suma de cantidad en stock × costo unitario de cada producto. Es el valor actual, no cambia con el mes elegido.</p>
                      {stockRows.length === 0 ? (
                        <p className="text-slate-400">No hay productos con stock registrado.</p>
                      ) : (
                        <table className="w-full">
                          <thead><tr className="text-left text-slate-400 dark:text-gray-500">
                            <th className="py-1 font-medium">Producto</th>
                            <th className="py-1 font-medium text-right">Stock</th>
                            <th className="py-1 font-medium text-right">Costo unit.</th>
                            <th className="py-1 font-medium text-right">Valor</th>
                          </tr></thead>
                          <tbody>
                            {stockRows.map((r) => (
                              <tr key={r.id} className="border-b border-slate-50 dark:border-gray-700/50">
                                <td className="py-1">{r.name}</td>
                                <td className="py-1 text-right">{r.qty}</td>
                                <td className="py-1 text-right text-slate-400">{fmt(r.price)}</td>
                                <td className="py-1 text-right font-semibold text-violet-600 dark:text-violet-400">{fmt(r.value)}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold text-slate-700 dark:text-gray-200">
                              <td className="pt-1.5" colSpan={3}>Total</td>
                              <td className="pt-1.5 text-right">{fmt(stockValue)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {drill && <DrilldownModal selected={drill} onClose={() => setDrill(null)} />}

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
    </PlanGate>
  );
}
