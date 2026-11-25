import apiClient from "@/lib/api-client";
import type { PdfPhoto, PlanPdfPhotos } from "@/lib/treatment-plan-pdf";

export interface PhotoCrop {
  x: number; // 0..1 sobre el ancho
  y: number;
  w: number;
  h: number;
}

export interface PhotoEdit {
  /** Giro en sentido horario: 0 | 90 | 180 | 270 */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** Recorte (normalizado 0..1) sobre la imagen ya girada/invertida */
  crop: PhotoCrop | null;
}

export const NO_EDIT: PhotoEdit = { rotation: 0, flipH: false, flipV: false, crop: null };
export const isEdited = (e: PhotoEdit) => e.rotation !== 0 || e.flipH || e.flipV || !!e.crop;

export interface PdfPhotoSelection {
  /** fotos generales, en orden de aparición */
  overview: { photoId: string; edit: PhotoEdit }[];
  /** foto por hemiarcada */
  groups: Record<string, { photoId: string; edit: PhotoEdit } | undefined>;
}

export const photoUrl = (patientId: string, photoId: string) =>
  `/api/v1/patients/${patientId}/photos/${photoId}/file`;

const blobCache = new Map<string, Blob>();

export async function fetchPhotoBlob(patientId: string, photoId: string): Promise<Blob> {
  const key = `${patientId}/${photoId}`;
  const hit = blobCache.get(key);
  if (hit) return hit;
  const { data } = await apiClient.get(photoUrl(patientId, photoId), { responseType: "blob" });
  blobCache.set(key, data as Blob);
  return data as Blob;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

/** Dibuja la imagen girada/invertida en un canvas (tamaño original). */
export function transformedCanvas(img: HTMLImageElement, edit: PhotoEdit): HTMLCanvasElement {
  const swap = edit.rotation === 90 || edit.rotation === 270;
  const w = swap ? img.naturalHeight : img.naturalWidth;
  const h = swap ? img.naturalWidth : img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((edit.rotation * Math.PI) / 180);
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c;
}

export async function loadPhotoImage(patientId: string, photoId: string) {
  return loadImage(await fetchPhotoBlob(patientId, photoId));
}

/** Aplica giro/inversión + recorte y reduce la foto a un JPEG liviano para el PDF. */
export async function renderPhotoForPdf(
  patientId: string,
  photoId: string,
  edit: PhotoEdit,
  label?: string,
  maxSide = 1000,
): Promise<PdfPhoto> {
  const img = await loadPhotoImage(patientId, photoId);
  const src = transformedCanvas(img, edit);
  const crop = edit.crop;
  const sx = crop ? Math.round(crop.x * src.width) : 0;
  const sy = crop ? Math.round(crop.y * src.height) : 0;
  const sw = crop ? Math.max(1, Math.round(crop.w * src.width)) : src.width;
  const sh = crop ? Math.max(1, Math.round(crop.h * src.height)) : src.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * scale));
  const ch = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: cw, height: ch, label };
}

export async function buildPdfPhotos(
  patientId: string,
  selection: PdfPhotoSelection,
  labelOf: (photoId: string) => string,
): Promise<PlanPdfPhotos> {
  const overview = await Promise.all(
    selection.overview.map((o) => renderPhotoForPdf(patientId, o.photoId, o.edit, labelOf(o.photoId), 900)),
  );
  const byGroup: PlanPdfPhotos["byGroup"] = {};
  for (const [key, sel] of Object.entries(selection.groups)) {
    if (!sel) continue;
    byGroup[key] = await renderPhotoForPdf(patientId, sel.photoId, sel.edit, undefined, 1000);
  }
  return { overview, byGroup };
}
