"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import apiClient from "@/lib/api-client";

// Caché de blob URLs por src — persiste mientras la pestaña esté abierta.
// Evita re-descargar la misma imagen al navegar o abrir el lightbox.
const blobCache = new Map<string, string>();

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** Si true, no espera a que el elemento entre en el viewport (útil para lightbox) */
  eager?: boolean;
}

export default function AuthImage({ src, alt = "", className = "", eager = false }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(() => blobCache.get(src) ?? null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(eager);
  const ref = useRef<HTMLDivElement>(null);

  // IntersectionObserver — solo empieza la descarga cuando el placeholder entra en vista
  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "200px" }  // pre-carga 200px antes de que llegue al viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible]);

  // Descarga — solo cuando es visible y no está en caché
  useEffect(() => {
    if (!visible) return;
    const cached = blobCache.get(src);
    if (cached) { setObjectUrl(cached); return; }

    let active = true;
    setObjectUrl(null);
    setError(false);

    apiClient
      .get(src, { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        const url = URL.createObjectURL(data as Blob);
        blobCache.set(src, url);
        setObjectUrl(url);
      })
      .catch(() => { if (active) setError(true); });

    return () => { active = false; };
  }, [src, visible]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-gray-700 text-slate-300 ${className}`}>
        <ImageOff size={20} />
      </div>
    );
  }

  if (!objectUrl) {
    return <div ref={ref} className={`animate-pulse bg-slate-200 dark:bg-gray-700 ${className}`} />;
  }

  return <img src={objectUrl} alt={alt} className={`object-cover ${className}`} />;
}
