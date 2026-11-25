"use client";

import { useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import AuthImage from "@/components/ui/AuthImage";
import Select from "@/components/ui/Select";
import PhotoCropModal from "@/components/treatments/PhotoCropModal";
import { usePatientPhotos, useUpdatePhotoEdit } from "@/hooks/usePhotos";
import { photoUrl, isEdited, normalizeEdit, type PhotoEdit, type PdfPhotoSelection } from "@/lib/pdf-photos";
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

type Editing = { kind: "overview"; photoId: string } | { kind: "group"; key: string } | null;

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

  function setGroupPhoto(key: string, photoId: string) {
    const groupsNext = { ...value.groups };
    if (!photoId) delete groupsNext[key];
    else groupsNext[key] = { photoId, edit: editOf(photoId) };
    onChange({ ...value, groups: groupsNext });
    if (photoId) setEditing({ kind: "group", key });
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
    const cur = value.groups[editing.key];
    if (cur) {
      modal = (
        <PhotoCropModal
          patientId={patientId}
          photoId={cur.photoId}
          title={`Editar foto — ${groups.find((g) => g.key === editing.key)?.label ?? ""}`}
          initial={cur.edit}
          onClose={() => setEditing(null)}
          onSave={(edit) => {
            onChange({ ...value, groups: { ...value.groups, [editing.key]: { photoId: cur.photoId, edit } } });
            persist(cur.photoId, edit);
            setEditing(null);
          }}
        />
      );
    }
  }

  const editBtn =
    "flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-600 px-2.5 py-2 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700";

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
                  <AuthImage src={photoUrl(patientId, p.id)} className="h-16 w-full object-cover" />
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
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Foto por hemiarcada</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">
            Se preselecciona la foto de categoría «Hemiarcada». Aparece bajo el costo de esa hemiarcada; puedes girarla,
            invertirla o recortarla.
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
                    <button type="button" onClick={() => setEditing({ kind: "group", key: g.key })} className={`mb-0.5 ${editBtn}`}>
                      <SlidersHorizontal size={13} />
                      {isEdited(sel.edit) ? <><Check size={12} className="text-green-600" /> Editada</> : "Editar"}
                    </button>
                  )}
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
