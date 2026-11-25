"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { fetchPhotoBlob, type PhotoCrop } from "@/lib/pdf-photos";

interface Props {
  patientId: string;
  photoId: string;
  title: string;
  initial: PhotoCrop | null;
  onSave: (crop: PhotoCrop | null) => void;
  onClose: () => void;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// Permite arrastrar sobre la foto para elegir la zona (hemiarcada) que se mostrará en el PDF.
export default function PhotoCropModal({ patientId, photoId, title, initial, onSave, onClose }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<PhotoCrop | null>(initial);
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    fetchPhotoBlob(patientId, photoId).then((b) => {
      if (!active) return;
      url = URL.createObjectURL(b);
      setSrc(url);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [patientId, photoId]);

  function point(e: React.PointerEvent) {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }
  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = point(e);
    setCrop({ ...start.current, w: 0, h: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setCrop({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function onUp() { start.current = null; }

  const valid = crop && crop.w > 0.03 && crop.h > 0.03;

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Arrastra sobre la foto para marcar la zona que verá el paciente (por ejemplo, solo esa hemiarcada).
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
              <img ref={imgRef} src={src} alt="" draggable={false} className="max-h-[55vh] max-w-full block" />
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
          <Button type="button" variant="secondary" onClick={() => setCrop(null)}>
            Usar foto completa
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={() => onSave(valid ? crop : null)}>Aceptar</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
