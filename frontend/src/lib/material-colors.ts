import type { ApiTreatment } from "@/hooks/useCostos";

// Colores opcionales para marcar materiales dentro de un tratamiento (independiente
// de los grupos alternativos). Sirven para distinguir, por ejemplo, los materiales
// que no siempre se usan y hay que revisar al registrar un pago.

export const MATERIAL_COLORS = {
  red:    { label: "Rojo",     dot: "bg-red-500",    row: "bg-red-50 dark:bg-red-900/20",       border: "border-l-red-500" },
  orange: { label: "Naranja",  dot: "bg-orange-500", row: "bg-orange-50 dark:bg-orange-900/20", border: "border-l-orange-500" },
  yellow: { label: "Amarillo", dot: "bg-yellow-400", row: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-l-yellow-400" },
  green:  { label: "Verde",    dot: "bg-green-500",  row: "bg-green-50 dark:bg-green-900/20",   border: "border-l-green-500" },
  blue:   { label: "Azul",     dot: "bg-blue-500",   row: "bg-blue-50 dark:bg-blue-900/20",     border: "border-l-blue-500" },
  purple: { label: "Morado",   dot: "bg-purple-500", row: "bg-purple-50 dark:bg-purple-900/20", border: "border-l-purple-500" },
  pink:   { label: "Rosado",   dot: "bg-pink-500",   row: "bg-pink-50 dark:bg-pink-900/20",     border: "border-l-pink-500" },
} as const;

export type MaterialColorId = keyof typeof MATERIAL_COLORS;

export function materialColor(id: string | null | undefined) {
  return id && id in MATERIAL_COLORS ? MATERIAL_COLORS[id as MaterialColorId] : null;
}

/** Color asignado a un material dentro de un tratamiento (primera coincidencia entre sus citas). */
export function colorForProduct(treatment: ApiTreatment | undefined | null, productId: string): string | null {
  if (!treatment) return null;
  for (const apt of treatment.appointments) {
    const m = apt.materials.find((x) => x.productId === productId && x.color);
    if (m?.color) return m.color;
  }
  return null;
}
