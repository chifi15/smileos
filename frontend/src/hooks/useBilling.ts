import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface PlanStatus {
  plan: "free" | "pro" | "clinic";
  plan_name: string;
  price_usd: number;
  patient_count: number;
  patient_limit: number | null;
  is_expired: boolean;
  plan_expires_at: string | null;
}

export function usePlanStatus() {
  return useQuery({
    queryKey: ["billing-plan"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PlanStatus }>("/api/v1/billing/plan");
      return data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}
