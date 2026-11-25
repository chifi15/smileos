"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { loadPhotoImage, transformedCanvas, downscale, NO_EDIT, type PhotoEdit } from "@/lib/pdf-photos";

interface Props {
  patientId: string;
  photoId: string;
  title: string;
  initial: PhotoEdit;
  onSave: (edit: PhotoEdit) => void;
  onClose: () => void;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// Girar, invertir y recortar la foto antes de ponerla en el PDF.
export default function PhotoCropModal({ patientId, photoId, title, initial, onSave, onClose }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [edit, setEdit] = useState<PhotoEdit>(initial);
  const [src, setSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadPhotoImage(patientId, photoId).then((i) => { if (active) setImg(i); });
    return () => { active = false; };
  }, [patientId, photoId]);

  // Vista previa con giro/inversión aplicados (JPEG liviano)
  const small = useMemo(() => (img ? downscale(img, 1000) : null), [img]);
  useEffect(() => {
    if (!small) return;
    const c = transformedCanvas(small, { ...edit, crop: null });
    setSrc(c.toDataURL("image/jpeg", 0.8));
  }, [small, edit.rotation, edit.flipH, edit.flipV, edit.tilt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cualquier giro/inversión invalida el recorte previo (cambian las coordenadas)
  const transform = (patch: Partial<PhotoEdit>) => setEdit((e) => ({ ...e, ...patch, crop: null }));
  const rotate = (delta: number) => transform({ rotation: (edit.rotation + delta + 360) % 360 });

  function point(e: React.PointerEvent) {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }
  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = point(e);
    setEdit((ed) => ({ ...ed, crop: { ...start.current!, w: 0, h: 0 } }));
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setEdit((ed) => ({
      ...ed,
      crop: { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) },
    }));
  }
  function onUp() { start.current = null; }

  const crop = edit.crop;
  const validCrop = crop && crop.w > 0.03 && crop.h > 0.03;

  const tool = "flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-600 px-2.5 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700";

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tool} onClick={() => rotate(-90)}><RotateCcw size={14} /> Girar izq.</button>
          <button type="button" className={tool} onClick={() => rotate(90)}><RotateCw size={14} /> Girar der.</button>
          <button type="button" className={tool} onClick={() => transform({ flipH: !edit.flipH })}>
            <FlipHorizontal2 size={14} /> Invertir horizontal
          </button>
          <button type="button" className={tool} onClick={() => transform({ flipV: !edit.flipV })}>
            <FlipVertical2 size={14} /> Invertir vertical
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600 dark:text-gray-300 shrink-0">Inclinar</label>
          <button type="button" className={tool} onClick={() => transform({ tilt: Math.max(-45, +(edit.tilt - 0.5).toFixed(1)) })}>−</button>
          <input
            type="range"
            min={-45}
            max={45}
            step={0.5}
            value={edit.tilt}
            onChange={(e) => transform({ tilt: parseFloat(e.target.value) })}
            className="flex-1 accent-blue-600"
          />
          <button type="button" className={tool} onClick={() => transform({ tilt: Math.min(45, +(edit.tilt + 0.5).toFixed(1)) })}>+</button>
          <span className="w-12 text-right text-xs tabular-nums text-slate-600 dark:text-gray-300">{edit.tilt.toFixed(1)}°</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Opcional: arrastra sobre la foto para recortar la zona que verá el paciente.
        </p>
        <div className="flex justify-center rounded-lg bg-slate-100 dark:bg-gray-900 p-2">
          {!src ? (
            <div className="py-16"><Spinner /></div>
          ) : (
            <div
              className="relative inline-block touch-none select-none cursor-crosshair"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src} alt="" draggable={false} className="max-h-[50vh] max-w-full block" />
              {crop && crop.w > 0 && (
                <div
                  className="absolute border-2 border-blue-500 pointer-events-none"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(15,23,42,0.5)",
                  }}
                />
              )}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setEdit(NO_EDIT)}>
            Restablecer
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={() => onSave({ ...edit, crop: validCrop ? crop : null })}>Aceptar</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
