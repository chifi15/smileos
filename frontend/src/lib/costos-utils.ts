import { Product, Treatment, TreatmentCostBreakdown } from "@/types/costos";

export function calculateTreatmentCosts(
  treatment: Treatment,
  products: Product[]
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
  const fixedCosts = treatment.fixedCosts;
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
