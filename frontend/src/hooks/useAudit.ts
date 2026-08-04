import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import type { AuditLog, PaginatedMeta } from "@/types";

interface AuditFeedParams {
  resource_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

interface AuditFeedResponse {
  data: AuditLog[];
  meta: PaginatedMeta;
}

export function useAuditFeed(params: AuditFeedParams = {}) {
  return useQuery<AuditFeedResponse>({
    queryKey: ["audit", "feed", params],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params.resource_type) p.set("resource_type", params.resource_type);
      if (params.date_from) p.set("date_from", params.date_from);
      if (params.date_to) p.set("date_to", params.date_to);
      if (params.page) p.set("page", String(params.page));
      if (params.per_page) p.set("per_page", String(params.per_page));
      const res = await api.get(`/api/v1/audit?${p}`);
      return { data: res.data.data, meta: res.data.meta };
    },
    staleTime: 0,
  });
}

export function usePatientAudit(patientId: string, params: { resource_type?: string; page?: number } = {}) {
  return useQuery<AuditFeedResponse>({
    queryKey: ["audit", "patient", patientId, params],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params.resource_type) p.set("resource_type", params.resource_type);
      if (params.page) p.set("page", String(params.page));
      const res = await api.get(`/api/v1/audit/patients/${patientId}?${p}`);
      return { data: res.data.data, meta: res.data.meta };
    },
    enabled: !!patientId,
    staleTime: 0,
  });
}
