import { Product, Treatment, TreatmentCostBreakdown, ProductCategory } from "@/types/costos";
import type { ApiProduct, ApiTreatment } from "@/hooks/useCostos";

export function apiProductToProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category as ProductCategory,
    unitPrice: p.unit_price,
    presentation: p.presentation,
    portionDescription: p.portion_description,
    supplier: p.supplier,
    notes: p.notes,
    totalCost: p.total_cost,
    presentationQty: p.presentation_qty,
    presentationUnit: p.presentation_unit,
    portionQty: p.portion_qty,
    stockQty: p.stock_qty,
    minStockQty: p.min_stock_qty,
  };
}

export function apiTreatmentToTreatment(t: ApiTreatment): Treatment {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    professionalFeePerHour: t.professional_fee_per_hour,
    totalHours: t.total_hours,
    fixedCosts: t.fixed_costs,
    clinicMarginPct: t.clinic_margin_pct,
    suggestedPrice: t.suggested_price,
    procedureCatalogId: t.procedure_catalog_id,
    appointments: t.appointments.map((a) => ({
      id: a.id,
      number: a.number,
      name: a.name,
      materials: a.materials,
    })),
  };
}

export function calculateTreatmentCosts(
  treatment: Treatment,
  products: Product[],
  globalFixedCostPerPatient?: number
): TreatmentCostBreakdown {
  const productMap = new Map(products.map((p) => [p.id, p]));

  const appointmentCosts = treatment.appointments.map((apt) => {
    const materials = apt.materials
      .map((usage) => {
        const product = productMap.get(usage.productId);
        if (!product) return null;
        return { product, quantity: usage.quantity, total: product.unitPrice * usage.quantity };
      })
      .filter(Boolean) as Array<{ product: Product; quantity: number; total: number }>;

    const materialCost = materials.reduce((sum, m) => sum + m.total, 0);
    return { appointment: apt, materialCost, materials };
  });

  const totalMaterialsCost = appointmentCosts.reduce((sum, a) => sum + a.materialCost, 0);
  const professionalFees = treatment.professionalFeePerHour * treatment.totalHours;
  const fixedCosts = globalFixedCostPerPatient ?? treatment.fixedCosts;
  const subtotal = totalMaterialsCost + professionalFees + fixedCosts;
  const margin = subtotal * treatment.clinicMarginPct;
  const calculatedPrice = subtotal + margin;
  const finalPrice = treatment.suggestedPrice ?? calculatedPrice;

  return {
    appointmentCosts,
    totalMaterialsCost,
    professionalFees,
    fixedCosts,
    subtotal,
    margin,
    calculatedPrice,
    finalPrice,
  };
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtC(n: number): string {
  return `C$ ${fmt(n)}`;
}

export function fmtUSD(cordobas: number, rate: number): string {
  return `$${fmt(cordobas / rate)}`;
}
