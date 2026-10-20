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

export interface NewPatientRow {
  patient_id: string;
  patient_name: string;
  phone: string | null;
  first_appointment_date: string;
  appointment_type: string;
  status: string;
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

export interface NewPatientsByMonthItem {
  year: number;
  month: number;
  count: number;
  patients: {
    patient_id: string;
    patient_name: string;
    phone: string | null;
    first_appointment_date: string;
    appointment_type: string;
  }[];
}

export function useNewPatientsHistory() {
  return useQuery({
    queryKey: ["dashboard", "new-patients-history"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: NewPatientsByMonthItem[] }>("/api/v1/dashboard/new-patients-history");
      return data.data;
    },
  });
}

export function useNewPatients() {
  return useQuery({
    queryKey: ["dashboard", "new-patients"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: NewPatientRow[] }>("/api/v1/dashboard/new-patients");
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
