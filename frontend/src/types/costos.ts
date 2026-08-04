export type ProductCategory =
  | "desechable"
  | "anestesia"
  | "endodoncia"
  | "restauracion"
  | "profilaxis"
  | "instrumental"
  | "otros";

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  desechable: "Desechables",
  anestesia: "Anestesia",
  endodoncia: "Endodoncia",
  restauracion: "Restauración",
  profilaxis: "Profilaxis",
  instrumental: "Esterilización",
  otros: "Otros",
};

export const PRODUCT_CATEGORY_COLORS: Record<ProductCategory, string> = {
  desechable: "bg-blue-50 text-blue-700",
  anestesia: "bg-purple-50 text-purple-700",
  endodoncia: "bg-orange-50 text-orange-700",
  restauracion: "bg-green-50 text-green-700",
  profilaxis: "bg-teal-50 text-teal-700",
  instrumental: "bg-slate-100 text-slate-600",
  otros: "bg-gray-50 text-gray-600",
};

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
}

export interface MaterialUsage {
  productId: string;
  quantity: number;
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
}

export interface AppointmentCostDetail {
  appointment: TreatmentAppointment;
  materialCost: number;
  materials: Array<{
    product: Product;
    quantity: number;
    total: number;
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
