"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import AuthImage from "@/components/ui/AuthImage";
import PhotoCropModal from "@/components/treatments/PhotoCropModal";
import { usePatientPhotos, useUpdatePhotoEdit } from "@/hooks/usePhotos";
import { photoThumbUrl, isEdited, normalizeEdit, type PhotoEdit, type PdfPhotoSelection } from "@/lib/pdf-photos";
import { PHOTO_TYPE_LABELS, type PatientPhoto, type PhotoType } from "@/types";

export const photoLabel = (p: PatientPhoto) =>
  PHOTO_TYPE_LABELS[p.photo_type as PhotoType] ?? (p.caption?.trim() || "Sin clasificar");

// Orden fijo de las fotos generales en el PDF
export const OVERVIEW_ORDER: string[] = ["smile", "lateral_right", "lateral_left", "occlusal_upper", "occlusal_lower"];
const rank = (type: string | undefined) => {
  const i = OVERVIEW_ORDER.indexOf(type ?? "");
  return i === -1 ? OVERVIEW_ORDER.length : i;
};

interface Props {
  patientId: string;
  groups: { key: string; label: string }[];
  value: PdfPhotoSelection;
  onChange: (v: PdfPhotoSelection) => void;
}

type Editing = { kind: "overview"; photoId: string } | { kind: "group"; key: string; photoId: string } | null;

export default function PdfPhotosPicker({ patientId, groups, value, onChange }: Props) {
  const { data: photos = [], isLoading } = usePatientPhotos(patientId);
  const [editing, setEditing] = useState<Editing>(null);
  const saveEdit = useUpdatePhotoEdit(patientId);

  if (isLoading) return null;
  if (photos.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-gray-500">
        Este paciente aún no tiene fotos. Súbelas en la pestaña Fotos para poder incluirlas en el PDF.
      </p>
    );
  }

  const typeOf = (id: string) => photos.find((p) => p.id === id)?.photo_type;
  // La edición guardada de cada foto se recupera automáticamente
  const editOf = (id: string) => normalizeEdit(photos.find((p) => p.id === id)?.pdf_edit as Partial<PhotoEdit> | null);
  // Guarda la edición en la foto (queda para la próxima vez) y en la selección actual
  const persist = (photoId: string, edit: PhotoEdit) =>
    saveEdit.mutate({ photoId, pdf_edit: isEdited(edit) ? edit : null });
  const sortOverview = (list: PdfPhotoSelection["overview"]) =>
    [...list].sort((a, b) => rank(typeOf(a.photoId)) - rank(typeOf(b.photoId)));

  function toggleOverview(id: string) {
    const has = value.overview.some((o) => o.photoId === id);
    const next = has
      ? value.overview.filter((o) => o.photoId !== id)
      : [...value.overview, { photoId: id, edit: editOf(id) }];
    onChange({ ...value, overview: sortOverview(next) });
  }

  function toggleGroupPhoto(key: string, photoId: string) {
    const cur = value.groups[key] ?? [];
    const has = cur.some((g) => g.photoId === photoId);
    const next = has ? cur.filter((g) => g.photoId !== photoId) : [...cur, { photoId, edit: editOf(photoId) }];
    onChange({ ...value, groups: { ...value.groups, [key]: next } });
  }

  let modal: React.ReactNode = null;
  if (editing?.kind === "overview") {
    const cur = value.overview.find((o) => o.photoId === editing.photoId);
    if (cur) {
      modal = (
        <PhotoCropModal
          patientId={patientId}
          photoId={cur.photoId}
          title={`Editar foto — ${photoLabel(photos.find((p) => p.id === cur.photoId)!)}`}
          initial={cur.edit}
          onClose={() => setEditing(null)}
          onSave={(edit) => {
            onChange({
              ...value,
              overview: value.overview.map((o) => (o.photoId === cur.photoId ? { ...o, edit } : o)),
            });
            persist(cur.photoId, edit);
            setEditing(null);
          }}
        />
      );
    }
  } else if (editing?.kind === "group") {
    const cur = value.groups[editing.key]?.find((g) => g.photoId === editing.photoId);
    if (cur) {
      modal = (
        <PhotoCropModal
          patientId={patientId}
          photoId={cur.photoId}
          title={`Editar foto — ${groups.find((g) => g.key === editing.key)?.label ?? ""}`}
          initial={cur.edit}
          onClose={() => setEditing(null)}
          onSave={(edit) => {
            onChange({
              ...value,
              groups: {
                ...value.groups,
                [editing.key]: (value.groups[editing.key] ?? []).map((g) => (g.photoId === cur.photoId ? { ...g, edit } : g)),
              },
            });
            persist(cur.photoId, edit);
            setEditing(null);
          }}
        />
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Fotos generales</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">
          Se preseleccionan por categoría y salen en este orden: sonrisa, lateral derecha, lateral izquierda, oclusal
          superior y oclusal inferior. Con el icono puedes girar, inclinar, invertir o recortar cada foto; los cambios quedan guardados.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p) => {
            const idx = value.overview.findIndex((o) => o.photoId === p.id);
            const sel = idx >= 0 ? value.overview[idx] : null;
            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-lg border-2 ${sel ? "border-blue-500" : "border-transparent"}`}
              >
                <button type="button" onClick={() => toggleOverview(p.id)} className="block w-full text-left">
                  <AuthImage src={photoThumbUrl(patientId, p.id, 200)} className="h-16 w-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                    {photoLabel(p)}
                  </span>
                </button>
                {sel && (
                  <>
                    <span className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      title="Girar / invertir / recortar"
                      onClick={() => setEditing({ kind: "overview", photoId: p.id })}
                      className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ${
                        isEdited(sel.edit) ? "bg-green-600" : "bg-black/60"
                      }`}
                    >
                      <SlidersHorizontal size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {groups.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Fotos por hemiarcada</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">
            Aquí aparecen solo las fotos que subiste con la categoría de cada hemiarcada (y se preseleccionan). Si subes
            más de una, puedes incluirlas todas; las de la misma orientación salen con el mismo tamaño. Con el icono
            puedes girar, invertir o recortar cada una.
          </p>
          <div className="space-y-3">
            {groups.map((g) => {
              const sels = value.groups[g.key] ?? [];
              // Solo las fotos subidas con la categoría de esta hemiarcada
              const groupPhotos = photos.filter((p) => p.photo_type === `hemi_${g.key}`);
              if (groupPhotos.length === 0) return null;
              return (
                <div key={g.key}>
                  <p className="text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">{g.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {groupPhotos.map((p) => {
                      const idx = sels.findIndex((s) => s.photoId === p.id);
                      const sel = idx >= 0 ? sels[idx] : null;
                      return (
                        <div
                          key={p.id}
                          className={`relative overflow-hidden rounded-lg border-2 ${sel ? "border-blue-500" : "border-transparent"}`}
                        >
                          <button type="button" onClick={() => toggleGroupPhoto(g.key, p.id)} className="block w-full text-left">
                            <AuthImage src={photoThumbUrl(patientId, p.id, 200)} className="h-16 w-full object-cover" />
                            <span className="absolute bottom-0 inset-x-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                              {photoLabel(p)}
                            </span>
                          </button>
                          {sel && (
                            <>
                              <span className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                                {idx + 1}
                              </span>
                              <button
                                type="button"
                                title="Girar / invertir / recortar"
                                onClick={() => setEditing({ kind: "group", key: g.key, photoId: p.id })}
                                className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ${
                                  isEdited(sel.edit) ? "bg-green-600" : "bg-black/60"
                                }`}
                              >
                                <SlidersHorizontal size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal}
    </div>
  );
}
