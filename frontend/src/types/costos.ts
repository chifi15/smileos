export type ProductCategory =
  | "desechable"
  | "anestesia"
  | "endodoncia"
  | "restauracion"
  | "profilaxis"
  | "instrumental"
  | "otros";

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  desechable: "Desechables",
  anestesia: "Anestesia",
  endodoncia: "Endodoncia",
  restauracion: "Restauración",
  profilaxis: "Profilaxis",
  instrumental: "Esterilización",
  otros: "Otros",
};

export const PRODUCT_CATEGORY_COLORS: Record<string, string> = {
  desechable:   "bg-blue-50    text-blue-700    dark:bg-blue-900/70    dark:text-blue-200",
  anestesia:    "bg-violet-50  text-violet-700  dark:bg-violet-900/70  dark:text-violet-200",
  endodoncia:   "bg-amber-50   text-amber-700   dark:bg-amber-900/70   dark:text-amber-200",
  restauracion: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200",
  profilaxis:   "bg-cyan-50    text-cyan-700    dark:bg-cyan-900/70    dark:text-cyan-200",
  instrumental: "bg-indigo-50  text-indigo-700  dark:bg-indigo-900/70  dark:text-indigo-200",
  otros:        "bg-zinc-100   text-zinc-600    dark:bg-zinc-800       dark:text-zinc-300",
};

export function categoryLabel(cat: string): string {
  return PRODUCT_CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function categoryColor(cat: string): string {
  return PRODUCT_CATEGORY_COLORS[cat] ?? "bg-gray-50 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300";
}

export interface FixedCostItem {
  id: string;
  name: string;
  amount: number; // C$ por mes
}

export interface FixedCostsConfig {
  items: FixedCostItem[];
  patientsPerMonth: number;
}

export const PRESENTATION_UNITS = ["ml", "L", "g", "mg", "kg", "gotas", "mm", "cm", "m", "unidades"] as const;
export type PresentationUnit = typeof PRESENTATION_UNITS[number];

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;          // costo por porción — fuente de verdad para cálculos
  presentation: string;       // texto libre (legado / resumen)
  portionDescription: string; // texto libre (legado)
  supplier?: string;
  notes?: string;
  // Calculadora de costo por porción
  totalCost?: number;         // C$ del producto completo
  presentationQty?: number;   // cantidad total (ej. 1000)
  presentationUnit?: string;  // unidad (ej. "ml")
  portionQty?: number;        // cantidad usada por porción (ej. 7)
  // Inventario
  stockQty?: number;          // stock actual (en presentationUnit, o en "usos" si no hay unidad)
  minStockQty?: number;       // alerta cuando baja de este valor
}

export interface MaterialUsage {
  productId: string;
  quantity: number;
  altGroup?: string | null;
}

export interface TreatmentAppointment {
  id: string;
  number: number;
  name: string;
  materials: MaterialUsage[];
}

export interface Treatment {
  id: string;
  name: string;
  description?: string;
  appointments: TreatmentAppointment[];
  professionalFeePerHour: number;
  totalHours: number;
  fixedCosts: number;
  clinicMarginPct: number;
  suggestedPrice?: number;
  procedureCatalogId?: string; // vincula con procedure_catalog del backend
}

export interface AppointmentCostDetail {
  appointment: TreatmentAppointment;
  materialCost: number;
  materials: Array<{
    product: Product;
    quantity: number;
    total: number;
    altGroup: string | null;
    countsInCost: boolean;
  }>;
}

export interface TreatmentCostBreakdown {
  appointmentCosts: AppointmentCostDetail[];
  totalMaterialsCost: number;
  professionalFees: number;
  fixedCosts: number;
  subtotal: number;
  margin: number;
  calculatedPrice: number;
  finalPrice: number;
}
