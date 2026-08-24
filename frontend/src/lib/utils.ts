import { useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
}

const _D = ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."];
const _M = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

/** Formatea una fecha como "lun. 21 ago. 2026". showWeekday=false omite el día de semana. */
export function fmtDate(dateStr: string, opts?: { showWeekday?: boolean; showYear?: boolean }) {
  const { showWeekday = true, showYear = true } = opts ?? {};
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  const parts: string[] = [];
  if (showWeekday) parts.push(_D[d.getDay()]);
  parts.push(String(d.getDate()).padStart(2, "0"));
  parts.push(_M[d.getMonth()]);
  if (showYear) parts.push(String(d.getFullYear()));
  return parts.join(" ");
}
