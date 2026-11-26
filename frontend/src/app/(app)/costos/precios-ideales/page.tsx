"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Target, TrendingDown, TrendingUp } from "lucide-react";
import {
  useCostProducts,
  useCostTreatments,
  useFixedCosts,
  useUpdateCostTreatment,
} from "@/hooks/useCostos";
import { apiProductToProduct, apiTreatmentToTreatment, calculateTreatmentCosts, fmtC } from "@/lib/costos-utils";
import Button from "@/components/ui/Button";

const ROUND_OPTIONS = [
  { value: 1, label: "Sin redondeo" },
  { value: 10, label: "Múltiplo de C$ 10" },
  { value: 50, label: "Múltiplo de C$ 50" },
  { value: 100, label: "Múltiplo de C$ 100" },
];

function roundUp(n: number, step: number): number {
  return step <= 1 ? Math.ceil(n) : Math.ceil(n / step) * step;
}

function NumField({ label, value, onChange, suffix, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; suffix: string; step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number" min={0} step={step} value={value}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-24 rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-500 dark:text-gray-400">{suffix}</span>
      </div>
    </label>
  );
}

export default function PreciosIdealesPage() {
  const { data: treatments = [], isLoading } = useCostTreatments();
  const { data: apiProducts = [] } = useCostProducts();
  const { data: fixedCosts } = useFixedCosts();
  const update = useUpdateCostTreatment();

  const [margin, setMargin] = useState(15);      // % de ganancia de la clínica sobre el costo
  const [discount, setDiscount] = useState(15);  // descuento máximo que quiero poder dar
  const [rate, setRate] = useState(37.15);       // C$ por USD
  const [step, setStep] = useState(10);
  const [applying, setApplying] = useState<string | null>(null);

  const totalFijo = (fixedCosts?.items ?? []).reduce((s, i) => s + i.amount, 0);
  const patients = fixedCosts?.patients_per_month ?? 1;
  const perPaciente = patients > 0 ? totalFijo / patients : 0;

  const rows = useMemo(() => {
    const products = apiProducts.map(apiProductToProduct);
    return treatments.map((raw) => {
      const b = calculateTreatmentCosts(apiTreatmentToTreatment(raw), products, perPaciente);
      const cost = b.subtotal;
      const current = b.finalPrice;
      // Precio con el que, tras el descuento máximo, aún queda el margen deseado sobre el costo
      const ideal = roundUp((cost * (1 + margin / 100)) / (1 - discount / 100), step);
      const minNoLoss = roundUp(cost, step);
      // Ganancia (sobre el costo) con el precio actual, sin y con descuento
      const profitNow = current - cost;
      const priceWithDisc = current * (1 - discount / 100);
      const profitWithDisc = priceWithDisc - cost;
      const pctWithDisc = cost > 0 ? (profitWithDisc / cost) * 100 : 0;
      const ok = current >= ideal;
      return { raw, cost, current, ideal, minNoLoss, profitNow, profitWithDisc, pctWithDisc, ok };
    });
  }, [treatments, apiProducts, perPaciente, margin, discount, step]);

  const pending = rows.filter((r) => !r.ok);

  async function apply(id: string, price: number) {
    setApplying(id);
    try {
      await update.mutateAsync({ id, suggested_price: price });
    } finally {
      setApplying(null);
    }
  }

  async function applyAll() {
    if (!confirm(`¿Aplicar el precio ideal a ${pending.length} tratamiento${pending.length !== 1 ? "s" : ""}? Los planes ya creados conservan su precio anterior.`)) return;
    for (const r of pending) await apply(r.raw.id, r.ideal);
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-slate-400 dark:text-gray-500">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link href="/costos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Costos operativos
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <Target size={20} className="text-blue-600" /> Precio ideal por tratamiento
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
            Precio de lista para que, aun dando el descuento máximo, la clínica conserve su ganancia.
          </p>
        </div>
        <Button size="sm" onClick={applyAll} disabled={pending.length === 0 || applying !== null}>
          <Check size={15} /> Aplicar a los {pending.length} por ajustar
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <NumField label="Ganancia mínima de la clínica (sobre el costo)" value={margin} onChange={setMargin} suffix="%" />
        <NumField label="Descuento máximo a ofrecer" value={discount} onChange={setDiscount} suffix="%" />
        <NumField label="Tipo de cambio" value={rate} onChange={setRate} suffix="C$/USD" step={0.5} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-gray-400">Redondear hacia arriba</span>
          <select
            value={step} onChange={(e) => setStep(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <p className="basis-full text-xs text-slate-400 dark:text-gray-500">
          Precio ideal = costo × (1 + ganancia) ÷ (1 − descuento). El costo incluye materiales, honorarios y costos fijos por cita
          (C$ {perPaciente.toFixed(2)} por paciente).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-slate-400 dark:text-gray-500">Aún no hay tratamientos en Costos operativos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700 text-left text-xs text-slate-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Tratamiento</th>
                <th className="px-3 py-3 text-right font-medium">Costo</th>
                <th className="px-3 py-3 text-right font-medium">Precio actual</th>
                <th className="px-3 py-3 text-right font-medium">Con {discount}% desc.</th>
                <th className="px-3 py-3 text-right font-medium">Precio ideal</th>
                <th className="px-3 py-3 text-right font-medium">Con {discount}% desc. paga</th>
                <th className="px-3 py-3 text-right font-medium">Clínica se queda</th>
                <th className="px-3 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const diff = r.ideal - r.current;
                const loses = r.profitWithDisc < 0;
                return (
                  <tr key={r.raw.id} className="border-b border-slate-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/costos/${r.raw.id}`} className="font-medium text-slate-800 dark:text-gray-100 hover:underline">
                        {r.raw.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-gray-300">{fmtC(r.cost)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-medium text-slate-800 dark:text-gray-100">{fmtC(r.current)}</div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">${(r.current / rate).toFixed(0)}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className={`font-medium ${loses ? "text-red-600 dark:text-red-400" : r.pctWithDisc < margin ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                        {r.pctWithDisc.toFixed(0)}% de ganancia
                      </div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">
                        {r.profitWithDisc >= 0 ? "+" : "−"}{fmtC(Math.abs(r.profitWithDisc))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-bold text-blue-700 dark:text-blue-400">{fmtC(r.ideal)}</div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">${(r.ideal / rate).toFixed(0)}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-bold text-slate-800 dark:text-gray-100">{fmtC(r.ideal * (1 - discount / 100))}</div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">${((r.ideal * (1 - discount / 100)) / rate).toFixed(0)}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <div className="font-medium text-green-700 dark:text-green-400">{fmtC(r.ideal - r.cost)}</div>
                      <div className="text-xs text-slate-400 dark:text-gray-500">
                        con {discount}% desc.: {fmtC(r.ideal * (1 - discount / 100) - r.cost)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <Check size={13} /> Bien
                          {diff < 0 && <span className="text-slate-400 dark:text-gray-500">(sobra {fmtC(-diff)})</span>}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {loses ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                            +{fmtC(diff)}
                          </span>
                          <button
                            onClick={() => apply(r.raw.id, r.ideal)}
                            disabled={applying !== null}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {applying === r.raw.id ? "…" : "Aplicar"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400 dark:text-gray-500">
        Aplicar guarda el precio ideal como precio paciente del tratamiento (solo afecta planes nuevos). Antes de subir mucho un precio,
        compáralo con lo que cobran otras clínicas de tu zona.
      </p>
    </div>
  );
}
