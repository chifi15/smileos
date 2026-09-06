import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { DashboardStats, ScheduleItem } from "@/types";

export interface MonthlyPatientRow {
  transaction_id: string;
  date: string;
  patient_id: string | null;
  patient_name: string;
  procedure_name: string | null;
  doctor_name: string | null;
  amount: number;
  description: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DashboardStats }>("/api/v1/dashboard");
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useMonthlyPatients() {
  return useQuery({
    queryKey: ["dashboard", "monthly-patients"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MonthlyPatientRow[] }>("/api/v1/dashboard/monthly-patients");
      return data.data;
    },
  });
}

export function useTodaySchedule() {
  return useQuery({
    queryKey: ["dashboard", "schedule"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ScheduleItem[] }>("/api/v1/dashboard/schedule");
      return data.data;
    },
    refetchInterval: 60_000,
  });
}
