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
  /** Inclinación fina en grados (-45..45), además del giro de 90° */
  tilt: number;
  /** Recorte (normalizado 0..1) sobre la imagen ya girada/invertida */
  crop: PhotoCrop | null;
}

export const NO_EDIT: PhotoEdit = { rotation: 0, flipH: false, flipV: false, tilt: 0, crop: null };
export const isEdited = (e: PhotoEdit) => e.rotation !== 0 || e.flipH || e.flipV || e.tilt !== 0 || !!e.crop;

/** Normaliza lo guardado en el servidor (puede venir vacío o incompleto). */
export function normalizeEdit(raw: Partial<PhotoEdit> | null | undefined): PhotoEdit {
  if (!raw) return NO_EDIT;
  return {
    rotation: [0, 90, 180, 270].includes(raw.rotation as number) ? (raw.rotation as number) : 0,
    flipH: !!raw.flipH,
    flipV: !!raw.flipV,
    tilt: typeof raw.tilt === "number" ? Math.max(-45, Math.min(45, raw.tilt)) : 0,
    crop: raw.crop && raw.crop.w > 0 && raw.crop.h > 0 ? raw.crop : null,
  };
}

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

type Source = HTMLImageElement | HTMLCanvasElement;
const dims = (src: Source) =>
  src instanceof HTMLImageElement ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };

/** Dibuja la imagen girada/inclinada/invertida en un canvas (el lienzo crece para no cortar esquinas). */
export function transformedCanvas(src: Source, edit: PhotoEdit): HTMLCanvasElement {
  const { w: iw, h: ih } = dims(src);
  const rad = ((edit.rotation + edit.tilt) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.max(1, Math.round(iw * cos + ih * sin));
  const h = Math.max(1, Math.round(iw * sin + ih * cos));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.drawImage(src, -iw / 2, -ih / 2);
  return c;
}

/** Copia reducida para vistas previas rápidas. */
export function downscale(src: Source, maxSide: number): HTMLCanvasElement {
  const { w, h } = dims(src);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
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
