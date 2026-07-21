import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { PatientDetail, PatientListItem, PatientFormValues, PaginatedMeta } from "@/types";

interface ListParams {
  search?: string;
  level?: string;
  active_only?: boolean;
  page?: number;
  per_page?: number;
}

function cleanValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
  );
}

export function usePatientSearch(query: string) {
  return useQuery({
    queryKey: ["patients", "search", query],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { id: string; full_name: string; phone: string | null }[];
      }>("/api/v1/patients/search", { params: { q: query, limit: 20 } });
      return data.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

export function usePatientList(params: ListParams = {}) {
  return useQuery({
    queryKey: ["patients", "list", params],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: PatientListItem[];
        meta: PaginatedMeta;
      }>("/api/v1/patients", {
        params: {
          active_only: true,
          per_page: 20,
          ...params,
        },
      });
      return data;
    },
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PatientDetail }>(`/api/v1/patients/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (body: PatientFormValues) => {
      const { data } = await apiClient.post<{ data: PatientDetail }>(
        "/api/v1/patients",
        cleanValues(body as unknown as Record<string, unknown>)
      );
      return data.data;
    },
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success(`Paciente ${patient.full_name} creado.`);
      router.push(`/patients/${patient.id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as any)?.response?.data?.detail ||
        "Error al crear el paciente.";
      toast.error(msg);
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (body: PatientFormValues) => {
      const { data } = await apiClient.patch<{ data: PatientDetail }>(
        `/api/v1/patients/${id}`,
        cleanValues(body as unknown as Record<string, unknown>)
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients", id] });
      toast.success("Paciente actualizado.");
      router.push(`/patients/${id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as any)?.response?.data?.detail ||
        "Error al actualizar el paciente.";
      toast.error(msg);
    },
  });
}

export function useDeactivatePatient() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/patients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente desactivado.");
      router.push("/patients");
    },
    onError: (err: unknown) => {
      const msg =
        (err as any)?.response?.data?.detail ||
        "Error al desactivar el paciente.";
      toast.error(msg);
    },
  });
}

export function useReactivatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/patients/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente reactivado.");
    },
    onError: () => toast.error("Error al reactivar el paciente."),
  });
}

export function useDeletePatientPermanent() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/patients/${id}/permanent`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente eliminado permanentemente.");
      router.push("/patients");
    },
    onError: (err: unknown) => {
      const data = (err as any)?.response?.data;
      const msg =
        data?.detail ||
        data?.error?.message ||
        data?.message ||
        JSON.stringify(data) ||
        "Error al eliminar el paciente.";
      toast.error(msg, { duration: 8000 });
    },
  });
}

export function useSetReferral(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referrerPatientId: string | null) =>
      apiClient.patch(`/api/v1/patients/${patientId}/referral`, {
        referrer_patient_id: referrerPatientId,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["patients", patientId] });
      const pointsAwarded = (res.data as any).points_awarded;
      if (pointsAwarded) {
        toast.success("Referidor asignado. Se otorgaron los puntos de referido.");
      } else {
        toast.success("Referidor actualizado.");
      }
      onSuccess?.();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data?.detail || data?.error?.message || "Error al asignar el referidor.";
      toast.error(msg);
    },
  });
}
