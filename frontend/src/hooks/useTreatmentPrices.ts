import { useMemo } from "react";
import { useCostTreatments, useCostProducts, useFixedCosts } from "@/hooks/useCostos";
import { apiProductToProduct, apiTreatmentToTreatment, calculateTreatmentCosts } from "@/lib/costos-utils";

/** Precio final calculado de cada tratamiento de Costos Operativos (id → precio). */
export function useTreatmentPrices() {
  const { data: treatments = [], isLoading: l1 } = useCostTreatments();
  const { data: apiProducts = [], isLoading: l2 } = useCostProducts();
  const { data: fixedCosts, isLoading: l3 } = useFixedCosts();

  const prices = useMemo(() => {
    const totalFijo = (fixedCosts?.items ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const perPaciente = (fixedCosts?.patients_per_month ?? 1) > 0
      ? totalFijo / (fixedCosts?.patients_per_month ?? 1)
      : 0;
    const products = apiProducts.map(apiProductToProduct);
    const map = new Map<string, number>();
    for (const t of treatments) {
      map.set(t.id, calculateTreatmentCosts(apiTreatmentToTreatment(t), products, perPaciente).finalPrice);
    }
    return map;
  }, [treatments, apiProducts, fixedCosts]);

  return { treatments, prices, isLoading: l1 || l2 || l3 };
}
