import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { DashboardStats, ScheduleItem } from "@/types";

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
