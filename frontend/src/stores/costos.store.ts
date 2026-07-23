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

      resetToSeed: () => set({ products: SEED_PRODUCTS, treatments: SEED_TREATMENTS }),
    }),
    { name: "smileos-costos-v1" }
  )
);
