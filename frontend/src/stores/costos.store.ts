import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, Treatment } from "@/types/costos";
import { SEED_PRODUCTS, SEED_TREATMENTS } from "@/lib/costos-seed";

interface CostosState {
  products: Product[];
  treatments: Treatment[];

  updateProduct: (id: string, updates: Partial<Omit<Product, "id">>) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  deleteProduct: (id: string) => void;

  addTreatment: (treatment: Treatment) => void;
  updateTreatment: (id: string, updates: Partial<Treatment>) => void;
  deleteTreatment: (id: string) => void;
  mergeAppointments: (treatmentId: string, targetId: string, sourceId: string) => void;

  resetToSeed: () => void;
}

export const useCostosStore = create<CostosState>()(
  persist(
    (set) => ({
      products: SEED_PRODUCTS,
      treatments: SEED_TREATMENTS,

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

      resetToSeed: () => set({ products: SEED_PRODUCTS, treatments: SEED_TREATMENTS }),
    }),
    { name: "smileos-costos-v2" }
  )
);
