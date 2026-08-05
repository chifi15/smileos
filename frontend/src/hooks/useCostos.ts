import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";

// ─── Types (matching backend) ──────────────────────────────────────────────

export interface ApiProduct {
  id: string;
  name: string;
  category: string;
  unit_price: number;
  presentation: string;
  portion_description: string;
  supplier?: string;
  notes?: string;
  total_cost?: number;
  presentation_qty?: number;
  presentation_unit?: string;
  portion_qty?: number;
  stock_qty?: number;
  min_stock_qty?: number;
  purchase_date?: string | null;
  sort_order: number;
}

export interface ApiMaterial {
  productId: string;
  quantity: number;
}

export interface ApiAppointment {
  id: string;
  number: number;
  name: string;
  materials: ApiMaterial[];
  sort_order: number;
}

export interface ApiTreatment {
  id: string;
  name: string;
  description?: string;
  professional_fee_per_hour: number;
  total_hours: number;
  fixed_costs: number;
  clinic_margin_pct: number;
  suggested_price?: number;
  procedure_catalog_id?: string;
  sort_order: number;
  appointments: ApiAppointment[];
}

export interface ApiFixedCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface ApiFixedCosts {
  patients_per_month: number;
  items: ApiFixedCostItem[];
}

export interface ApiProductLot {
  id: string;
  product_id: string;
  opened_at: string;
  expected_portions?: number | null;
  used_portions: number;
  finished_at?: string | null;
  notes?: string | null;
  created_at: string;
}

// ─── Keys ─────────────────────────────────────────────────────────────────

const PRODUCTS_KEY = ["costos", "products"] as const;
const TREATMENTS_KEY = ["costos", "treatments"] as const;
const FIXED_COSTS_KEY = ["costos", "fixed-costs"] as const;

// ─── Products ─────────────────────────────────────────────────────────────

export function useCostProducts() {
  return useQuery<ApiProduct[]>({
    queryKey: PRODUCTS_KEY,
    queryFn: () => api.get("/api/v1/costos/products").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCostProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ApiProduct, "id" | "sort_order" | "stock_qty" | "min_stock_qty">) =>
      api.post("/api/v1/costos/products", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateCostProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Omit<ApiProduct, "sort_order" | "stock_qty" | "min_stock_qty"> & { id: string }) =>
      api.put(`/api/v1/costos/products/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useDeleteCostProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/costos/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useReorderCostProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post("/api/v1/costos/products/reorder", { ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: PRODUCTS_KEY });
      const prev = qc.getQueryData<ApiProduct[]>(PRODUCTS_KEY);
      if (prev) {
        const map = new Map(prev.map((p) => [p.id, p]));
        qc.setQueryData<ApiProduct[]>(PRODUCTS_KEY, ids.map((id, i) => ({ ...map.get(id)!, sort_order: i })));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(PRODUCTS_KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateCostProductStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty, operation }: { id: string; qty: number; operation: "set" | "add" }) =>
      api.post(`/api/v1/costos/products/${id}/stock`, { qty, operation }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateCostProductMinStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, min_qty }: { id: string; min_qty: number | null }) =>
      api.patch(`/api/v1/costos/products/${id}/min-stock`, { min_qty }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

// ─── Treatments ───────────────────────────────────────────────────────────

export function useCostTreatments() {
  return useQuery<ApiTreatment[]>({
    queryKey: TREATMENTS_KEY,
    queryFn: () => api.get("/api/v1/costos/treatments").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCostTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      professional_fee_per_hour: number;
      total_hours: number;
      fixed_costs: number;
      clinic_margin_pct: number;
      suggested_price?: number;
      appointments: { number: number; name: string; materials: ApiMaterial[] }[];
    }) => api.post("/api/v1/costos/treatments", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useUpdateCostTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<ApiTreatment, "id" | "appointments">>) =>
      api.put(`/api/v1/costos/treatments/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useDeleteCostTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/costos/treatments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useReorderCostTreatments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post("/api/v1/costos/treatments/reorder", { ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: TREATMENTS_KEY });
      const prev = qc.getQueryData<ApiTreatment[]>(TREATMENTS_KEY);
      if (prev) {
        const map = new Map(prev.map((t) => [t.id, t]));
        qc.setQueryData<ApiTreatment[]>(TREATMENTS_KEY, ids.map((id, i) => ({ ...map.get(id)!, sort_order: i })));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(TREATMENTS_KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useAddCostAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treatmentId: string) =>
      api.post(`/api/v1/costos/treatments/${treatmentId}/appointments`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useUpdateCostAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, aptId, ...data }: { treatmentId: string; aptId: string; name?: string; materials?: ApiMaterial[] }) =>
      api.put(`/api/v1/costos/treatments/${treatmentId}/appointments/${aptId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useDeleteCostAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, aptId }: { treatmentId: string; aptId: string }) =>
      api.delete(`/api/v1/costos/treatments/${treatmentId}/appointments/${aptId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useMergeCostAppointments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, targetId, sourceId }: { treatmentId: string; targetId: string; sourceId: string }) =>
      api.post(`/api/v1/costos/treatments/${treatmentId}/appointments/merge`, { target_id: targetId, source_id: sourceId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

export function useLinkCostProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, procedureCatalogId }: { treatmentId: string; procedureCatalogId: string | null }) =>
      api.put(`/api/v1/costos/treatments/${treatmentId}`, { procedure_catalog_id: procedureCatalogId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TREATMENTS_KEY }),
  });
}

// ─── Fixed Costs ──────────────────────────────────────────────────────────

export function useFixedCosts() {
  return useQuery<ApiFixedCosts>({
    queryKey: FIXED_COSTS_KEY,
    queryFn: () => api.get("/api/v1/costos/fixed-costs").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateFixedCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiFixedCosts) =>
      api.put("/api/v1/costos/fixed-costs", data).then((r) => r.data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: FIXED_COSTS_KEY });
      const prev = qc.getQueryData<ApiFixedCosts>(FIXED_COSTS_KEY);
      qc.setQueryData<ApiFixedCosts>(FIXED_COSTS_KEY, data);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(FIXED_COSTS_KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: FIXED_COSTS_KEY }),
  });
}

// ─── Product Lots ──────────────────────────────────────────────────────────

export function useProductLots(productId: string | null) {
  return useQuery<ApiProductLot[]>({
    queryKey: ["costos", "lots", productId],
    queryFn: () => api.get(`/api/v1/costos/products/${productId}/lots`).then((r) => r.data),
    enabled: !!productId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useOpenProductLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, opened_at, expected_portions, notes }: {
      productId: string;
      opened_at: string;
      expected_portions?: number | null;
      notes?: string | null;
    }) => api.post(`/api/v1/costos/products/${productId}/lots`, { opened_at, expected_portions, notes }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["costos", "lots", vars.productId] }),
  });
}

export function useUpdateProductLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, lotId, ...data }: {
      productId: string;
      lotId: string;
      opened_at?: string;
      expected_portions?: number | null;
      notes?: string | null;
    }) => api.patch(`/api/v1/costos/products/${productId}/lots/${lotId}`, data).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["costos", "lots", vars.productId] }),
  });
}

export function useFinishProductLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, lotId, finished_at }: { productId: string; lotId: string; finished_at: string }) =>
      api.patch(`/api/v1/costos/products/${productId}/lots/${lotId}/finish`, { finished_at }).then((r) => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["costos", "lots", vars.productId] }),
  });
}

export function useDeleteProductLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, lotId }: { productId: string; lotId: string }) =>
      api.delete(`/api/v1/costos/products/${productId}/lots/${lotId}`),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["costos", "lots", vars.productId] }),
  });
}
