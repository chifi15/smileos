"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ImagePlus, Trash2, X, ChevronLeft as Prev, ChevronRight as Next, Camera } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { usePatient } from "@/hooks/usePatients";
import { usePatientPhotos, useUploadPhoto, useDeletePhoto } from "@/hooks/usePhotos";
import { PatientPhoto, PhotoType, PHOTO_TYPE_LABELS } from "@/types";
import AuthImage from "@/components/ui/AuthImage";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";

const PHOTO_TYPE_COLORS: Record<PhotoType, string> = {
  profile: "bg-indigo-100 text-indigo-700",
  intraoral_frontal: "bg-purple-100 text-purple-700",
  intraoral_lateral_right: "bg-violet-100 text-violet-700",
  intraoral_lateral_left: "bg-fuchsia-100 text-fuchsia-700",
  extraoral_frontal: "bg-teal-100 text-teal-700",
  extraoral_profile: "bg-cyan-100 text-cyan-700",
  xray: "bg-blue-100 text-blue-700",
  other: "bg-slate-100 text-slate-500",
};

const photoTypeOptions = (Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((k) => ({
  value: k,
  label: PHOTO_TYPE_LABELS[k],
}));

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
}

function UploadModal({ open, onClose, patientId }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<PhotoType>("intraoral_frontal");
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState(format(new Date(), "yyyy-MM-dd"));

  const upload = useUploadPhoto(patientId, () => {
    resetForm();
    onClose();
  });

  function resetForm() {
    setFile(null);
    setPreview(null);
    setCaption("");
    setPhotoType("intraoral_frontal");
    setTakenAt(format(new Date(), "yyyy-MM-dd"));
  }

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    multiple: false,
  });

  function handleSubmit() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("photo_type", photoType);
    if (caption.trim()) fd.append("caption", caption.trim());
    fd.append("taken_at", takenAt);
    upload.mutate(fd);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Subir fotografía" size="md">
      <div className="space-y-4">
        {!file ? (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            <input {...getInputProps()} />
            <Camera size={32} className="text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                {isDragActive ? "Suelta la imagen aquí" : "Arrastra una imagen o haz clic para seleccionar"}
              </p>
              <p className="mt-1 text-xs text-slate-400">JPG, PNG o WebP</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <img
              src={preview ?? ""}
              alt="Vista previa"
              className="w-full max-h-48 object-contain rounded-lg bg-slate-100"
            />
            <button
              onClick={resetForm}
              className="absolute top-2 right-2 rounded-full bg-white p-1 shadow-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <Select
          label="Tipo de fotografía"
          value={photoType}
          onChange={(e) => setPhotoType(e.target.value as PhotoType)}
          options={photoTypeOptions}
        />
        <Input
          label="Descripción (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Ej: Vista frontal inicial"
        />
        <Input
          label="Fecha"
          type="date"
          value={takenAt}
          onChange={(e) => setTakenAt(e.target.value)}
        />
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!file}
          loading={upload.isPending}
        >
          Subir
        </Button>
      </div>
    </Modal>
  );
}

interface LightboxProps {
  photos: PatientPhoto[];
  index: number;
  patientId: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function PhotoLightbox({ photos, index, patientId, onClose, onPrev, onNext }: LightboxProps) {
  const photo = photos[index];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X size={20} />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
        >
          <Prev size={20} />
        </button>
      )}

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
        >
          <Next size={20} />
        </button>
      )}

      {/* Image */}
      <div
        className="flex flex-col items-center gap-3 max-w-4xl max-h-screen p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthImage
          src={`/api/v1/patients/${patientId}/photos/${photo.id}/file`}
          alt={photo.caption ?? ""}
          className="max-h-[75vh] max-w-full rounded-lg"
        />
        <div className="flex items-center gap-3">
          <Badge
            label={PHOTO_TYPE_LABELS[photo.photo_type]}
            className={`${PHOTO_TYPE_COLORS[photo.photo_type]}`}
          />
          {photo.caption && (
            <p className="text-sm text-white/80">{photo.caption}</p>
          )}
          <p className="text-xs text-white/50">
            {format(parseISO(photo.taken_at ?? photo.created_at), "d MMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-white/40">
            {index + 1} / {photos.length}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PatientPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: photos = [], isLoading } = usePatientPhotos(id);
  const deletePhoto = useDeletePhoto(id);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);

  const groupedPhotos = (Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).reduce(
    (acc, type) => {
      const group = photos.filter((p) => p.photo_type === type);
      if (group.length > 0) acc[type] = group;
      return acc;
    },
    {} as Partial<Record<PhotoType, PatientPhoto[]>>
  );

  function handleDelete(photoId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm("¿Eliminar esta fotografía?")) {
      deletePhoto.mutate(photoId);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">Fotografías</h1>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <ImagePlus size={16} />
          Subir foto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Camera size={40} className="text-slate-300" />
          <p className="text-sm text-slate-400">No hay fotografías registradas.</p>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            Subir primera foto
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(groupedPhotos) as [PhotoType, PatientPhoto[]][]).map(
            ([type, group]) => (
              <div key={type}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {PHOTO_TYPE_LABELS[type]}
                  <span className="ml-2 font-normal normal-case text-slate-400">
                    ({group.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.map((photo) => {
                    const globalIndex = photos.findIndex((p) => p.id === photo.id);
                    return (
                      <div
                        key={photo.id}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => setLightboxIndex(globalIndex)}
                      >
                        <AuthImage
                          src={`/api/v1/patients/${id}/photos/${photo.id}/file`}
                          alt={photo.caption ?? ""}
                          className="aspect-square w-full"
                        />
                        <button
                          className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-400 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                          onClick={(e) => handleDelete(photo.id, e)}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                        <div className="p-2">
                          {photo.caption && (
                            <p className="truncate text-xs text-slate-600">{photo.caption}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            {format(
                              parseISO(photo.taken_at ?? photo.created_at),
                              "d MMM yyyy",
                              { locale: es }
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        patientId={id}
      />

      {lightboxIndex >= 0 && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          patientId={id}
          onClose={() => setLightboxIndex(-1)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, i - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(photos.length - 1, i + 1))}
        />
      )}
    </div>
  );
}
