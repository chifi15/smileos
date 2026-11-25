import apiClient from "@/lib/api-client";
import type { PdfPhoto, PlanPdfPhotos } from "@/lib/treatment-plan-pdf";

export interface PhotoCrop {
  x: number; // 0..1 sobre el ancho
  y: number;
  w: number;
  h: number;
}

export interface PdfPhotoSelection {
  /** ids de fotos generales, en orden */
  overview: string[];
  /** foto + recorte por hemiarcada */
  groups: Record<string, { photoId: string; crop: PhotoCrop | null } | undefined>;
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

/** Recorta (opcional) y reduce la foto a un JPEG liviano para el PDF. */
export async function renderPhotoForPdf(
  patientId: string,
  photoId: string,
  crop: PhotoCrop | null,
  label?: string,
  maxSide = 1000,
): Promise<PdfPhoto> {
  const img = await loadImage(await fetchPhotoBlob(patientId, photoId));
  const sx = crop ? Math.round(crop.x * img.naturalWidth) : 0;
  const sy = crop ? Math.round(crop.y * img.naturalHeight) : 0;
  const sw = crop ? Math.max(1, Math.round(crop.w * img.naturalWidth)) : img.naturalWidth;
  const sh = crop ? Math.max(1, Math.round(crop.h * img.naturalHeight)) : img.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * scale));
  const ch = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: cw, height: ch, label };
}

export async function buildPdfPhotos(
  patientId: string,
  selection: PdfPhotoSelection,
  labelOf: (photoId: string) => string,
): Promise<PlanPdfPhotos> {
  const overview = await Promise.all(
    selection.overview.map((id) => renderPhotoForPdf(patientId, id, null, labelOf(id), 900)),
  );
  const byGroup: PlanPdfPhotos["byGroup"] = {};
  for (const [key, sel] of Object.entries(selection.groups)) {
    if (!sel) continue;
    byGroup[key] = await renderPhotoForPdf(patientId, sel.photoId, sel.crop, undefined, 1000);
  }
  return { overview, byGroup };
}
