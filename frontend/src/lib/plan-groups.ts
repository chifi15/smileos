// ─── Hemiarcadas (cuadrantes FDI) ────────────────────────────────────────────
export type GroupKey = "sd" | "si" | "ii" | "id" | "multi" | "general";

export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "sd", label: "Hemiarcada superior derecha" },
  { key: "si", label: "Hemiarcada superior izquierda" },
  { key: "ii", label: "Hemiarcada inferior izquierda" },
  { key: "id", label: "Hemiarcada inferior derecha" },
  { key: "multi", label: "Más de una hemiarcada" },
  { key: "general", label: "General (sin pieza específica)" },
];

// Primer dígito FDI: 1/5 sup. derecha, 2/6 sup. izquierda, 3/7 inf. izquierda, 4/8 inf. derecha
const QUADRANT: Record<string, GroupKey> = {
  "1": "sd", "5": "sd",
  "2": "si", "6": "si",
  "3": "ii", "7": "ii",
  "4": "id", "8": "id",
};

export function groupForTooth(toothFdi: string | null): GroupKey {
  if (!toothFdi) return "general";
  const teeth = toothFdi.match(/[1-8][1-8]/g);
  if (!teeth || teeth.length === 0) return "general";
  const quadrants = new Set(teeth.map((t) => QUADRANT[t[0]]));
  return quadrants.size === 1 ? [...quadrants][0] : "multi";
}
