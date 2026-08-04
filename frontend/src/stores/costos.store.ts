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

  addTreatment: (treatment: Treatment) => void;
  updateTreatment: (id: string, updates: Partial<Treatment>) => void;
  deleteTreatment: (id: string) => void;
  reorderTreatments: (orderedIds: string[]) => void;
  addAppointment: (treatmentId: string) => void;
  deleteAppointment: (treatmentId: string, aptId: string) => void;
  mergeAppointments: (treatmentId: string, targetId: string, sourceId: string) => void;

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
