import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, Treatment, FixedCostItem, FixedCostsConfig } from "@/types/costos";
import { SEED_PRODUCTS, SEED_TREATMENTS } from "@/lib/costos-seed";

const SEED_FIXED_COSTS: FixedCostsConfig = {
  items: [
    { id: "fc-renta",      name: "Renta del local",        amount: 3000 },
    { id: "fc-asistente",  name: "Pago de asistente",      amount: 3000 },
    { id: "fc-energia",    name: "Energía eléctrica (luz)", amount: 1500 },
    { id: "fc-agua",       name: "Agua",                   amount: 300  },
    { id: "fc-gasolina",   name: "Gasolina",               amount: 500  },
    { id: "fc-internet",   name: "Internet / teléfono",    amount: 340  },
  ],
  patientsPerMonth: 40,
};
// Total: 8,640 / 40 = 216 por paciente (coincide con el valor semilla actual)

interface CostosState {
  products: Product[];
  treatments: Treatment[];
  fixedCostsConfig: FixedCostsConfig;

  updateProduct: (id: string, updates: Partial<Omit<Product, "id">>) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  deleteProduct: (id: string) => void;
  reorderProducts: (orderedIds: string[]) => void;

  addTreatment: (treatment: Treatment) => void;
  updateTreatment: (id: string, updates: Partial<Treatment>) => void;
  deleteTreatment: (id: string) => void;
  reorderTreatments: (orderedIds: string[]) => void;
  addAppointment: (treatmentId: string) => void;
  deleteAppointment: (treatmentId: string, aptId: string) => void;
  mergeAppointments: (treatmentId: string, targetId: string, sourceId: string) => void;

  addStock: (productId: string, qty: number) => void;
  setStock: (productId: string, qty: number) => void;
  setMinStock: (productId: string, qty: number | undefined) => void;
  deductTreatmentMaterials: (procedureCatalogId: string, procedureQty: number) => void;
  linkProcedure: (treatmentId: string, procedureCatalogId: string | undefined) => void;

  addFixedCostItem: (name: string, amount: number) => void;
  updateFixedCostItem: (id: string, updates: Partial<Pick<FixedCostItem, "name" | "amount">>) => void;
  deleteFixedCostItem: (id: string) => void;
  setPatientsPerMonth: (n: number) => void;

  resetToSeed: () => void;
}

export const useCostosStore = create<CostosState>()(
  persist(
    (set) => ({
      products: SEED_PRODUCTS,
      treatments: SEED_TREATMENTS,
      fixedCostsConfig: SEED_FIXED_COSTS,

      updateProduct: (id, updates) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      addProduct: (product) =>
        set((s) => ({
          products: [...s.products, { ...product, id: crypto.randomUUID() }],
        })),

      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      reorderProducts: (orderedIds) =>
        set((s) => ({
          products: orderedIds
            .map((id) => s.products.find((p) => p.id === id))
            .filter(Boolean) as Product[],
        })),

      addTreatment: (treatment) =>
        set((s) => ({ treatments: [...s.treatments, treatment] })),

      updateTreatment: (id, updates) =>
        set((s) => ({
          treatments: s.treatments.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      deleteTreatment: (id) =>
        set((s) => ({ treatments: s.treatments.filter((t) => t.id !== id) })),

      reorderTreatments: (orderedIds) =>
        set((s) => ({
          treatments: orderedIds
            .map((id) => s.treatments.find((t) => t.id === id))
            .filter(Boolean) as Treatment[],
        })),

      addAppointment: (treatmentId) =>
        set((s) => ({
          treatments: s.treatments.map((t) => {
            if (t.id !== treatmentId) return t;
            const n = t.appointments.length + 1;
            return {
              ...t,
              appointments: [
                ...t.appointments,
                { id: crypto.randomUUID(), number: n, name: `Cita ${n}`, materials: [] },
              ],
            };
          }),
        })),

      deleteAppointment: (treatmentId, aptId) =>
        set((s) => ({
          treatments: s.treatments.map((t) => {
            if (t.id !== treatmentId) return t;
            const remaining = t.appointments
              .filter((a) => a.id !== aptId)
              .map((a, i) => ({ ...a, number: i + 1, name: a.name.match(/^Cita \d+$/) ? `Cita ${i + 1}` : a.name }));
            return { ...t, appointments: remaining };
          }),
        })),

      addStock: (productId, qty) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, stockQty: (p.stockQty ?? 0) + qty } : p
          ),
        })),

      setStock: (productId, qty) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, stockQty: Math.max(0, qty) } : p
          ),
        })),

      setMinStock: (productId, qty) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, minStockQty: qty } : p
          ),
        })),

      deductTreatmentMaterials: (procedureCatalogId, procedureQty) =>
        set((s) => {
          const treatment = s.treatments.find(
            (t) => t.procedureCatalogId === procedureCatalogId
          );
          if (!treatment) return s;

          // Suma todos los materiales de todas las citas
          const totals = new Map<string, number>();
          for (const apt of treatment.appointments) {
            for (const m of apt.materials) {
              totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.quantity);
            }
          }

          const updatedProducts = s.products.map((p) => {
            const usedPortions = totals.get(p.id);
            if (!usedPortions) return p;
            const deductQty = p.portionQty
              ? usedPortions * p.portionQty * procedureQty
              : usedPortions * procedureQty;
            return { ...p, stockQty: Math.max(0, (p.stockQty ?? 0) - deductQty) };
          });

          return { products: updatedProducts };
        }),

      linkProcedure: (treatmentId, procedureCatalogId) =>
        set((s) => ({
          treatments: s.treatments.map((t) =>
            t.id === treatmentId ? { ...t, procedureCatalogId } : t
          ),
        })),

      addFixedCostItem: (name, amount) =>
        set((s) => ({
          fixedCostsConfig: {
            ...s.fixedCostsConfig,
            items: [...s.fixedCostsConfig.items, { id: crypto.randomUUID(), name, amount }],
          },
        })),

      updateFixedCostItem: (id, updates) =>
        set((s) => ({
          fixedCostsConfig: {
            ...s.fixedCostsConfig,
            items: s.fixedCostsConfig.items.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            ),
          },
        })),

      deleteFixedCostItem: (id) =>
        set((s) => ({
          fixedCostsConfig: {
            ...s.fixedCostsConfig,
            items: s.fixedCostsConfig.items.filter((item) => item.id !== id),
          },
        })),

      setPatientsPerMonth: (n) =>
        set((s) => ({
          fixedCostsConfig: { ...s.fixedCostsConfig, patientsPerMonth: Math.max(1, n) },
        })),

      mergeAppointments: (treatmentId, targetId, sourceId) =>
        set((s) => ({
          treatments: s.treatments.map((t) => {
            if (t.id !== treatmentId) return t;
            const target = t.appointments.find((a) => a.id === targetId);
            const source = t.appointments.find((a) => a.id === sourceId);
            if (!target || !source) return t;
            const mergedMaterials = [...target.materials];
            for (const srcMat of source.materials) {
              const existing = mergedMaterials.find((m) => m.productId === srcMat.productId);
              if (existing) existing.quantity += srcMat.quantity;
              else mergedMaterials.push({ ...srcMat });
            }
            const updated = t.appointments
              .filter((a) => a.id !== sourceId)
              .map((a, i) => ({
                ...a,
                number: i + 1,
                materials: a.id === targetId ? mergedMaterials : a.materials,
              }));
            return { ...t, appointments: updated };
          }),
        })),

      resetToSeed: () => set({ products: SEED_PRODUCTS, treatments: SEED_TREATMENTS, fixedCostsConfig: SEED_FIXED_COSTS }),
    }),
    { name: "smileos-costos-v2" }
  )
);
