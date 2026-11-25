import type { ApiProduct, ApiTreatment } from "@/hooks/useCostos";

// Lógica de costo operativo de un pago con tratamiento. Es la misma que usa el
// formulario de Finanzas, para que el costo sea idéntico sin importar desde dónde se registre.

export type UsedMaterial = { productId: string; qty: number; altGroup?: string | null };

/** Materiales de una cita concreta, o de todas las citas del tratamiento si no se elige una. */
export function getMaterialsForSpec(
  treatment: ApiTreatment | undefined | null,
  appointmentId: string
): UsedMaterial[] {
  if (!treatment) return [];
  if (appointmentId) {
    const apt = treatment.appointments.find((a) => a.id === appointmentId);
    if (!apt) return [];
    return apt.materials.map((m) => ({ productId: m.productId, qty: m.quantity, altGroup: m.altGroup ?? null }));
  }
  const totals = new Map<string, number>();
  const groups = new Map<string, string | null>();
  for (const apt of treatment.appointments) {
    for (const m of apt.materials) {
      totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.quantity);
      if (!groups.has(m.productId)) groups.set(m.productId, m.altGroup ?? null);
    }
  }
  return Array.from(totals.entries()).map(([productId, qty]) => ({
    productId,
    qty,
    altGroup: groups.get(productId) ?? null,
  }));
}

/** De cada grupo de alternativos se queda con el más caro (si empatan, el primero). */
export function autoSelectAltGroups(materials: UsedMaterial[], products: ApiProduct[]): UsedMaterial[] {
  const priceOf = (id: string) => products.find((p) => p.id === id)?.unit_price ?? 0;
  const winners = new Map<string, UsedMaterial>();
  for (const m of materials) {
    if (!m.altGroup) continue;
    const existing = winners.get(m.altGroup);
    if (!existing || priceOf(m.productId) > priceOf(existing.productId)) winners.set(m.altGroup, m);
  }
  const seenGroups = new Set<string>();
  return materials.filter((m) => {
    if (!m.altGroup) return true;
    if (seenGroups.has(m.altGroup)) return false;
    if (winners.get(m.altGroup)?.productId === m.productId) {
      seenGroups.add(m.altGroup);
      return true;
    }
    return false;
  });
}

export function calcMaterialsCost(materials: { productId: string; qty: number }[], products: ApiProduct[]): number {
  return materials.reduce((sum, m) => {
    const product = products.find((p) => p.id === m.productId);
    return sum + (product ? product.unit_price * m.qty : 0);
  }, 0);
}

export interface OpCostBreakdown {
  matCost: number;
  hon: number;
  fixed: number;
  ganancia: number;
  marginPct: number;
  total: number;
}

export function calcOpCost(args: {
  treatment: ApiTreatment;
  appointmentId: string;
  materials: UsedMaterial[] | null;
  products: ApiProduct[];
  qty: number;
  sessions: number;
  scaleFees: boolean;
}): OpCostBreakdown {
  const { treatment, appointmentId, materials, products } = args;
  const qty = Math.max(1, args.qty);
  const sessions = Math.max(1, args.sessions);
  const feeQty = args.scaleFees ? qty : 1;

  const marginPct = treatment.clinic_margin_pct ?? 0;
  const profFees = (treatment.professional_fee_per_hour || 0) * (treatment.total_hours || 0);
  const fixedCosts = treatment.fixed_costs || 0;
  const totalApts = treatment.appointments.length || 1;
  const matCost = materials !== null ? calcMaterialsCost(materials, products) : 0;

  let hon: number;
  let fixed: number;
  if (appointmentId) {
    hon = (profFees / totalApts) * feeQty;
    fixed = fixedCosts * feeQty;
  } else {
    hon = (profFees * feeQty) / sessions;
    fixed = (fixedCosts * totalApts * feeQty) / sessions;
  }
  const raw = matCost + hon + fixed;
  const ganancia = raw * marginPct;
  const total = Math.round((raw + ganancia) * 100) / 100;
  return { matCost, hon, fixed, ganancia, marginPct, total };
}
