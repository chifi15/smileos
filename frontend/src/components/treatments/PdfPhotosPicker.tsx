"use client";

import { useState } from "react";
import { Crop, Check } from "lucide-react";
import AuthImage from "@/components/ui/AuthImage";
import Select from "@/components/ui/Select";
import PhotoCropModal from "@/components/treatments/PhotoCropModal";
import { usePatientPhotos } from "@/hooks/usePhotos";
import { photoUrl, type PdfPhotoSelection } from "@/lib/pdf-photos";
import { PHOTO_TYPE_LABELS, type PatientPhoto } from "@/types";

export const photoLabel = (p: PatientPhoto) => p.caption?.trim() || PHOTO_TYPE_LABELS[p.photo_type];

interface Props {
  patientId: string;
  groups: { key: string; label: string }[];
  value: PdfPhotoSelection;
  onChange: (v: PdfPhotoSelection) => void;
}

export default function PdfPhotosPicker({ patientId, groups, value, onChange }: Props) {
  const { data: photos = [], isLoading } = usePatientPhotos(patientId);
  const [cropping, setCropping] = useState<string | null>(null); // group key

  if (isLoading) return null;
  if (photos.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-gray-500">
        Este paciente aún no tiene fotos. Súbelas en la pestaña Fotos para poder incluirlas en el PDF.
      </p>
    );
  }

  function toggleOverview(id: string) {
    const has = value.overview.includes(id);
    onChange({ ...value, overview: has ? value.overview.filter((x) => x !== id) : [...value.overview, id] });
  }

  function setGroupPhoto(key: string, photoId: string) {
    const groupsNext = { ...value.groups };
    if (!photoId) delete groupsNext[key];
    else groupsNext[key] = { photoId, crop: null };
    onChange({ ...value, groups: groupsNext });
    if (photoId) setCropping(key);
  }

  const cropGroup = cropping ? value.groups[cropping] : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Fotos generales</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">
          Sonrisa, laterales, oclusales… se muestran juntas antes de la tabla de costos.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p) => {
            const idx = value.overview.indexOf(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleOverview(p.id)}
                className={`relative overflow-hidden rounded-lg border-2 text-left ${
                  idx >= 0 ? "border-blue-500" : "border-transparent"
                }`}
              >
                <AuthImage src={photoUrl(patientId, p.id)} className="h-16 w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                  {photoLabel(p)}
                </span>
                {idx >= 0 && (
                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Foto por hemiarcada</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">
            Elige la foto y recorta la zona: aparece bajo el costo de esa hemiarcada.
          </p>
          <div className="space-y-2">
            {groups.map((g) => {
              const sel = value.groups[g.key];
              return (
                <div key={g.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      label={g.label}
                      value={sel?.photoId ?? ""}
                      onChange={(e) => setGroupPhoto(g.key, e.target.value)}
                      options={[
                        { value: "", label: "— Sin foto —" },
                        ...photos.map((p) => ({ value: p.id, label: photoLabel(p) })),
                      ]}
                    />
                  </div>
                  {sel && (
                    <button
                      type="button"
                      onClick={() => setCropping(g.key)}
                      className="mb-0.5 flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-600 px-2.5 py-2 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                    >
                      <Crop size={13} />
                      {sel.crop ? <><Check size={12} className="text-green-600" /> Recortada</> : "Recortar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cropping && cropGroup && (
        <PhotoCropModal
          patientId={patientId}
          photoId={cropGroup.photoId}
          title={`Recortar — ${groups.find((g) => g.key === cropping)?.label ?? ""}`}
          initial={cropGroup.crop}
          onClose={() => setCropping(null)}
          onSave={(crop) => {
            onChange({ ...value, groups: { ...value.groups, [cropping]: { photoId: cropGroup.photoId, crop } } });
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

