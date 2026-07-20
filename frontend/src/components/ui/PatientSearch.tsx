"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  full_name: string;
  phone: string | null;
  rewards_level: string | null;
}

interface PatientSearchProps {
  value: { id: string; name: string } | null;
  onChange: (patient: { id: string; name: string } | null) => void;
  placeholder?: string;
}

export default function PatientSearch({ value, onChange, placeholder }: PatientSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["patients", "search", debounced],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: SearchResult[] }>(
        "/api/v1/patients/search",
        { params: { q: debounced, limit: 8 } }
      );
      return data.data;
    },
    enabled: debounced.length >= 2,
  });

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 h-10 px-3">
        <span className="text-sm font-medium text-blue-800 truncate">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 shrink-0 text-blue-400 hover:text-blue-600"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Buscar paciente por nombre o teléfono..."}
          className={cn(
            "h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          )}
        />
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {!data || data.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Sin resultados.</p>
          ) : (
            data.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onChange({ id: p.id, name: p.full_name });
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {p.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                  {p.phone && <p className="text-xs text-slate-500">{p.phone}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
