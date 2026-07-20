"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import apiClient from "@/lib/api-client";

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export default function AuthImage({ src, alt = "", className = "" }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url = "";
    setObjectUrl(null);
    setError(false);

    apiClient
      .get(src, { responseType: "blob" })
      .then(({ data }) => {
        url = URL.createObjectURL(data as Blob);
        setObjectUrl(url);
      })
      .catch(() => setError(true));

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}>
        <ImageOff size={20} />
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  }

  return <img src={objectUrl} alt={alt} className={`object-cover ${className}`} />;
}
