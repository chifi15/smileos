import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { PatientPhoto } from "@/types";

export function usePatientPhotos(patientId: string) {
  return useQuery({
    queryKey: ["photos", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PatientPhoto[] }>(
        `/api/v1/patients/${patientId}/photos`
      );
      return data.data;
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUploadPhoto(patientId: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post(
        `/api/v1/patients/${patientId}/photos`,
        formData
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos", patientId] });
      toast.success("Fotografía subida.");
      onSuccess?.();
    },
    onError: () => toast.error("Error al subir la fotografía."),
  });
}

export function useDeletePhoto(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      apiClient.delete(`/api/v1/patients/${patientId}/photos/${photoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos", patientId] });
      toast.success("Fotografía eliminada.");
    },
    onError: () => toast.error("Error al eliminar la fotografía."),
  });
}

export function useReorderPhotos(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) =>
      apiClient.put(`/api/v1/patients/${patientId}/photos/reorder`, { order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos", patientId] });
      toast.success("Orden guardado.");
    },
    onError: () => toast.error("Error al guardar el orden."),
  });
}
