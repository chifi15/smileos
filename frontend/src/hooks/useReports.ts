import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface MonthTrend {
  month: number;
  mes: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
}

export interface ReportSummary {
  ingresos_brutos: number;
  egresos: number;
  costos_operativos: number;
  ingreso_neto: number;
  utilidad_neta: number;
  margen_pct: number;
  count_ingresos: number;
  count_egresos: number;
}

export interface TopProcedure {
  procedure_id: string;
  procedure_name: string;
  total: number;
  quantity: number;
}

export interface TopProcedureQuoted {
  procedure_id: string;
  procedure_name: string;
  quoted: number;
  total_cotizado: number;
}

export interface TopExpense {
  category: string;
  total: number;
  count: number;
  pct: number;
}

export interface DoctorReport {
  doctor_id: string | null;
  doctor_name: string;
  ingresos: number;
  transacciones: number;
  costos_op: number;
}

export interface TopPatient {
  patient_id: string;
  patient_name: string;
  total: number;
  count: number;
}

export interface IncomeDetailRow {
  id: string;
  date: string;
  patient_name: string | null;
  procedure_name: string | null;
  doctor_name: string | null;
  description: string;
  amount: number;
}

export interface ExpenseDetailRow {
  id: string;
  date: string;
  category: string;
  category_label: string;
  description: string;
  amount: number;
  invoice_number: string | null;
}

export interface OpCostRow {
  procedure_id: string | null;
  procedure_name: string;
  count: number;
  avg_op_cost: number;
  total_op_cost: number;
}

export interface MaterialMonthGroup {
  month: number;
  mes: string;
  total_units: number;
  total_cost: number;
  materials: TopMaterial[];
}

export interface TopMaterial {
  product_id: string;
  name: string;
  category: string;
  unit_price: number;
  total_units: number;
  total_cost: number;
}

const base = "/api/v1/reports/finances";

export function useReportSummary(year: number, month: number) {
  return useQuery({
    queryKey: ["report-summary", year, month],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ReportSummary }>(
        `${base}/summary?year=${year}&month=${month}`
      );
      return data.data;
    },
  });
}

export function useMonthlyTrend(year: number) {
  return useQuery({
    queryKey: ["report-trend", year],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MonthTrend[] }>(
        `${base}/monthly-trend?year=${year}`
      );
      return data.data;
    },
  });
}

export function useTopProcedures(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-top-procedures", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: TopProcedure[] }>(
        `${base}/top-procedures?${params}`
      );
      return data.data;
    },
  });
}

export function useTopProceduresQuoted(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-top-quoted", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: TopProcedureQuoted[] }>(
        `${base}/top-procedures-quoted?${params}`
      );
      return data.data;
    },
  });
}

export function useTopExpenses(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-top-expenses", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: TopExpense[] }>(
        `${base}/top-expenses?${params}`
      );
      return data.data;
    },
  });
}

export function useDoctorReport(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-doctors", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: DoctorReport[] }>(
        `${base}/by-doctor?${params}`
      );
      return data.data;
    },
  });
}

export function useTopPatients(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-top-patients", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: TopPatient[] }>(
        `${base}/top-patients?${params}`
      );
      return data.data;
    },
  });
}

export function useMaterialsByMonth(year: number) {
  return useQuery({
    queryKey: ["report-materials-by-month", year],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MaterialMonthGroup[] }>(
        `${base}/materials-by-month?year=${year}`
      );
      return data.data;
    },
  });
}

export function useIncomeDetail(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-income-detail", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: IncomeDetailRow[] }>(
        `${base}/income-detail?${params}`
      );
      return data.data;
    },
  });
}

export function useExpenseDetail(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-expense-detail", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: ExpenseDetailRow[] }>(
        `${base}/expense-detail?${params}`
      );
      return data.data;
    },
  });
}

export function useOpCostsBreakdown(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-op-costs", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: OpCostRow[] }>(
        `${base}/op-costs-breakdown?${params}`
      );
      return data.data;
    },
  });
}

export function useTopMaterials(year: number, month: number | null) {
  return useQuery({
    queryKey: ["report-top-materials", year, month],
    queryFn: async () => {
      const params = month ? `year=${year}&month=${month}` : `year=${year}`;
      const { data } = await apiClient.get<{ data: TopMaterial[] }>(
        `${base}/top-materials?${params}`
      );
      return data.data;
    },
  });
}
