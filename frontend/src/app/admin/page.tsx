"use client";

import { useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import {
  ShieldCheck,
  Building2,
  Users,
  UserCheck,
  Package,
  Stethoscope,
  DollarSign,
  Trash2,
  Plus,
  X,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://smileos.onrender.com";

function api(secret: string) {
  return axios.create({
    baseURL: API,
    headers: { "X-Admin-Secret": secret },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClinicRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_expires_at: string | null;
  is_active: boolean;
  patient_count: number;
  user_count: number;
  owner_email: string | null;
  display_name: string;
  created_at: string;
}

interface ClinicDetail {
  products: { id: string; name: string; category: string; unit_price: number; presentation: string; presentation_unit: string | null; stock_qty: number | null; min_stock_qty: number | null }[];
  treatments: { id: string; name: string; professional_fee_per_hour: number; total_hours: number; suggested_price: number | null }[];
  fixed_costs: { patients_per_month: number; fee_per_hour: number; items: { id: string; name: string; amount: number }[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  clinic: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

// ─── Secret Gate ──────────────────────────────────────────────────────────────

function SecretGate({ onAuth }: { onAuth: (s: string) => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(val).get("/api/v1/admin/clinics");
      onAuth(val);
    } catch {
      setErr(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-slate-100 dark:border-gray-700 p-8">
        <div className="flex justify-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600">
            <ShieldCheck size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-center text-xl font-bold text-slate-800 dark:text-white mb-1">SmileOS Admin</h1>
        <p className="text-center text-sm text-slate-500 dark:text-gray-400 mb-6">Ingresa el secreto de administrador</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={val}
            onChange={(e) => { setVal(e.target.value); setErr(false); }}
            placeholder="Admin secret"
            className="w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          {err && <p className="text-xs text-red-500">Secreto incorrecto.</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
      {plan.toUpperCase()}
    </span>
  );
}

// ─── Clinic Drawer ────────────────────────────────────────────────────────────

type Tab = "plan" | "inventario" | "tratamientos" | "costos";

function ClinicDrawer({
  clinic,
  secret,
  onClose,
  onPlanChanged,
}: {
  clinic: ClinicRow;
  secret: string;
  onClose: () => void;
  onPlanChanged: (id: string, plan: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("plan");
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const { data } = await api(secret).get(`/api/v1/admin/clinics/${clinic.id}`);
      setDetail(data.data);
    } finally {
      setLoadingDetail(false);
    }
  }, [clinic.id, secret]);

  function switchTab(t: Tab) {
    setTab(t);
    if ((t === "inventario" || t === "tratamientos" || t === "costos") && !detail) {
      loadDetail();
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "plan", label: "Plan", icon: ShieldCheck },
    { key: "inventario", label: "Inventario", icon: Package },
    { key: "tratamientos", label: "Tratamientos", icon: Stethoscope },
    { key: "costos", label: "Costos Fijos", icon: DollarSign },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{clinic.display_name}</h2>
              <PlanBadge plan={clinic.plan} />
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{clinic.owner_email ?? clinic.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-gray-700 px-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex items-center gap-1.5 py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "plan" && (
            <PlanTab clinic={clinic} secret={secret} onPlanChanged={onPlanChanged} />
          )}
          {tab === "inventario" && (
            <InventarioTab clinicId={clinic.id} secret={secret} detail={detail} loading={loadingDetail} onReload={loadDetail} />
          )}
          {tab === "tratamientos" && (
            <TratamientosTab clinicId={clinic.id} secret={secret} detail={detail} loading={loadingDetail} onReload={loadDetail} />
          )}
          {tab === "costos" && (
            <CostosFijosTab clinicId={clinic.id} secret={secret} detail={detail} loading={loadingDetail} onReload={loadDetail} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Plan Tab ─────────────────────────────────────────────────────────────────

function PlanTab({
  clinic,
  secret,
  onPlanChanged,
}: {
  clinic: ClinicRow;
  secret: string;
  onPlanChanged: (id: string, plan: string) => void;
}) {
  const [plan, setPlan] = useState(clinic.plan);
  const [expiresAt, setExpiresAt] = useState(
    clinic.plan_expires_at ? clinic.plan_expires_at.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const plans = [
    { key: "free", label: "Free", sub: "30 pacientes", color: "border-slate-300 dark:border-gray-600" },
    { key: "pro", label: "Pro", sub: "Ilimitado · $29/mes", color: "border-blue-400" },
    { key: "clinic", label: "Clinic", sub: "Ilimitado · $59/mes", color: "border-violet-500" },
  ];

  async function save() {
    setSaving(true);
    try {
      await api(secret).patch(`/api/v1/admin/clinics/${clinic.id}/plan`, {
        plan,
        plan_expires_at: expiresAt ? new Date(expiresAt + "T23:59:59Z").toISOString() : null,
      });
      onPlanChanged(clinic.id, plan);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">Plan activo</p>
        <div className="grid grid-cols-3 gap-3">
          {plans.map(({ key, label, sub, color }) => (
            <button
              key={key}
              onClick={() => setPlan(key)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                plan === key
                  ? `${color} bg-violet-50 dark:bg-violet-900/20`
                  : "border-slate-100 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
              }`}
            >
              <p className="font-bold text-slate-800 dark:text-white">{label}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {plan !== "free" && (
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1.5">
            Vence el (opcional)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-48 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-800 dark:text-white focus:border-violet-400 focus:outline-none"
          />
          {expiresAt && (
            <button onClick={() => setExpiresAt("")} className="ml-2 text-xs text-slate-400 hover:text-red-500 transition-colors">
              Quitar fecha
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Guardar plan
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={15} />
            Guardado
          </div>
        )}
      </div>

      {/* Clinic info summary */}
      <div className="rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-3">Información</p>
        {[
          { label: "Slug", value: clinic.slug },
          { label: "Pacientes activos", value: clinic.patient_count },
          { label: "Usuarios", value: clinic.user_count },
          { label: "Propietario", value: clinic.owner_email ?? "—" },
          { label: "Registrado", value: format(parseISO(clinic.created_at), "d MMM yyyy", { locale: es }) },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-gray-400">{label}</span>
            <span className="font-medium text-slate-700 dark:text-gray-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inventario Tab ───────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = [
  "anestesia", "resinas", "adhesivos", "cementos", "endodoncia",
  "periodoncia", "cirugia", "protesis", "ortodoncia", "higiene",
  "rayos_x", "desechables", "otros",
];

function InventarioTab({
  clinicId,
  secret,
  detail,
  loading,
  onReload,
}: {
  clinicId: string;
  secret: string;
  detail: ClinicDetail | null;
  loading: boolean;
  onReload: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", category: "otros", unit_price: "", presentation: "",
    presentation_unit: "", stock_qty: "", min_stock_qty: "",
  });

  function setF(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(secret).post(`/api/v1/admin/clinics/${clinicId}/products`, {
        name: form.name,
        category: form.category,
        unit_price: parseFloat(form.unit_price) || 0,
        presentation: form.presentation,
        presentation_unit: form.presentation_unit || null,
        stock_qty: form.stock_qty !== "" ? parseFloat(form.stock_qty) : null,
        min_stock_qty: form.min_stock_qty !== "" ? parseFloat(form.min_stock_qty) : null,
      });
      setForm({ name: "", category: "otros", unit_price: "", presentation: "", presentation_unit: "", stock_qty: "", min_stock_qty: "" });
      setShowForm(false);
      onReload();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    setDeleting(id);
    try {
      await api(secret).delete(`/api/v1/admin/clinics/${clinicId}/products/${id}`);
      onReload();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
          Productos ({detail?.products.length ?? "…"})
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onReload} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            <Plus size={13} />
            Agregar
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={addProduct} className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Nuevo producto</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                required
                placeholder="Nombre del producto *"
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
            <select
              value={form.category}
              onChange={(e) => setF("category", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Precio unitario"
              value={form.unit_price}
              onChange={(e) => setF("unit_price", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            />
            <input
              placeholder="Presentación (ej: Caja x 100)"
              value={form.presentation}
              onChange={(e) => setF("presentation", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            />
            <input
              placeholder="Unidad (ej: unid, ml, g)"
              value={form.presentation_unit}
              onChange={(e) => setF("presentation_unit", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Stock actual"
              value={form.stock_qty}
              onChange={(e) => setF("stock_qty", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Stock mínimo"
              value={form.min_stock_qty}
              onChange={(e) => setF("min_stock_qty", e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Agregar producto
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
      ) : !detail || detail.products.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">Sin productos</div>
      ) : (
        <div className="rounded-xl border border-slate-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Categoría</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Precio</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Stock</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
              {detail.products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-300">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs">{p.category}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-400">
                    {p.unit_price > 0 ? `C$ ${p.unit_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">
                    {p.stock_qty != null ? `${p.stock_qty}${p.presentation_unit ? ` ${p.presentation_unit}` : ""}` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => deleteProduct(p.id)}
                      disabled={deleting === p.id}
                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tratamientos Tab ─────────────────────────────────────────────────────────

function TratamientosTab({
  clinicId,
  secret,
  detail,
  loading,
  onReload,
}: {
  clinicId: string;
  secret: string;
  detail: ClinicDetail | null;
  loading: boolean;
  onReload: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", professional_fee_per_hour: "192",
    total_hours: "1", suggested_price: "",
  });

  function setF(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function addTreatment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(secret).post(`/api/v1/admin/clinics/${clinicId}/treatments`, {
        name: form.name,
        description: form.description || null,
        professional_fee_per_hour: parseFloat(form.professional_fee_per_hour) || 192,
        total_hours: parseFloat(form.total_hours) || 1,
        suggested_price: form.suggested_price !== "" ? parseFloat(form.suggested_price) : null,
      });
      setForm({ name: "", description: "", professional_fee_per_hour: "192", total_hours: "1", suggested_price: "" });
      setShowForm(false);
      onReload();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTreatment(id: string) {
    setDeleting(id);
    try {
      await api(secret).delete(`/api/v1/admin/clinics/${clinicId}/treatments/${id}`);
      onReload();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
          Tratamientos de costos ({detail?.treatments.length ?? "…"})
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onReload} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            <Plus size={13} />
            Agregar
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={addTreatment} className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Nuevo tratamiento</p>
          <input
            required
            placeholder="Nombre del tratamiento *"
            value={form.name}
            onChange={(e) => setF("name", e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          />
          <input
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setF("description", e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 block mb-1">Honorario/hr (C$)</label>
              <input
                type="number"
                step="0.01"
                value={form.professional_fee_per_hour}
                onChange={(e) => setF("professional_fee_per_hour", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 block mb-1">Horas</label>
              <input
                type="number"
                step="0.5"
                value={form.total_hours}
                onChange={(e) => setF("total_hours", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 block mb-1">Precio sugerido (C$)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={form.suggested_price}
                onChange={(e) => setF("suggested_price", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Agregar tratamiento
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
      ) : !detail || detail.treatments.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">Sin tratamientos de costos</div>
      ) : (
        <div className="rounded-xl border border-slate-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Tratamiento</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Horas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Precio sug.</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
              {detail.treatments.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-gray-300">{t.name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-gray-400">{t.total_hours}h</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-gray-400">
                    {t.suggested_price != null ? `C$ ${t.suggested_price.toLocaleString("es-NI")}` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => deleteTreatment(t.id)}
                      disabled={deleting === t.id}
                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Costos Fijos Tab ─────────────────────────────────────────────────────────

function CostosFijosTab({
  clinicId,
  secret,
  detail,
  loading,
  onReload,
}: {
  clinicId: string;
  secret: string;
  detail: ClinicDetail | null;
  loading: boolean;
  onReload: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [patientsPerMonth, setPatientsPerMonth] = useState("");
  const [feePerHour, setFeePerHour] = useState("");
  const [items, setItems] = useState<{ id: string; name: string; amount: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (detail && !loaded) {
    setPatientsPerMonth(String(detail.fixed_costs.patients_per_month));
    setFeePerHour(String(detail.fixed_costs.fee_per_hour));
    setItems(detail.fixed_costs.items.map((i) => ({ ...i, amount: String(i.amount) })));
    setLoaded(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: "" }]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: "name" | "amount", value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(secret).put(`/api/v1/admin/clinics/${clinicId}/fixed-costs`, {
        patients_per_month: parseInt(patientsPerMonth) || 40,
        fee_per_hour: parseFloat(feePerHour) || 192,
        items: items
          .filter((i) => i.name.trim())
          .map((i) => ({ id: i.id, name: i.name, amount: parseFloat(i.amount) || 0 })),
      });
      onReload();
      setLoaded(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1.5">
                Pacientes / mes
              </label>
              <input
                type="number"
                value={patientsPerMonth}
                onChange={(e) => setPatientsPerMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              />
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Para calcular el costo fijo por paciente</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1.5">
                Honorario por hora (C$)
              </label>
              <input
                type="number"
                step="0.01"
                value={feePerHour}
                onChange={(e) => setFeePerHour(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              />
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Honorario del dentista por hora clínica</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Costos fijos mensuales</p>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 font-medium transition-colors"
              >
                <Plus size={13} />
                Agregar ítem
              </button>
            </div>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700 py-6 text-center text-sm text-slate-400 dark:text-gray-500">
                No hay costos fijos configurados
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      placeholder="Nombre del costo (ej: Renta)"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none"
                    />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">C$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={item.amount}
                        onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1 border-t border-slate-100 dark:border-gray-700">
                  <span className="text-slate-500 dark:text-gray-400">Total mensual</span>
                  <span className="font-semibold text-slate-700 dark:text-gray-300">
                    C$ {items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString("es-NI", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Guardar configuración
            </button>
            {saved && (
              <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 size={15} />
                Guardado
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("admin_secret") : null
  );
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ClinicRow | null>(null);
  const [search, setSearch] = useState("");

  function handleAuth(s: string) {
    sessionStorage.setItem("admin_secret", s);
    setSecret(s);
    loadClinics(s);
  }

  async function loadClinics(s: string) {
    setLoading(true);
    try {
      const { data } = await api(s).get("/api/v1/admin/clinics");
      setClinics(data.data);
    } finally {
      setLoading(false);
    }
  }

  if (!secret) {
    return <SecretGate onAuth={handleAuth} />;
  }

  if (clinics.length === 0 && !loading) {
    loadClinics(secret);
  }

  const filtered = clinics.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  function handlePlanChanged(id: string, plan: string) {
    setClinics((prev) => prev.map((c) => c.id === id ? { ...c, plan } : c));
    if (selected?.id === id) setSelected((p) => p ? { ...p, plan } : p);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">SmileOS Admin</h1>
              <p className="text-xs text-slate-400 dark:text-gray-500">Panel de plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-gray-700 px-3 py-1.5">
              <Building2 size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{clinics.length} clínicas</span>
            </div>
            <button
              onClick={() => loadClinics(secret)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              onClick={() => { sessionStorage.removeItem("admin_secret"); setSecret(null); }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="mb-4">
          <input
            type="search"
            placeholder="Buscar clínica por nombre, email o slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Clínica</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    <Users size={12} className="inline mr-1" />Pacientes
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    <UserCheck size={12} className="inline mr-1" />Usuarios
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Propietario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">Registro</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-gray-500">
                      No se encontraron clínicas
                    </td>
                  </tr>
                )}
                {filtered.map((clinic) => (
                  <tr
                    key={clinic.id}
                    className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(clinic)}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-white">{clinic.display_name}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">/{clinic.slug}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <PlanBadge plan={clinic.plan} />
                        {clinic.plan_expires_at && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-500">
                            Vence {format(parseISO(clinic.plan_expires_at), "d MMM yy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-600 dark:text-gray-400 font-medium">{clinic.patient_count}</td>
                    <td className="px-4 py-3.5 text-center text-slate-600 dark:text-gray-400">{clinic.user_count}</td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-gray-400 text-xs">{clinic.owner_email ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-400 dark:text-gray-500 text-xs whitespace-nowrap">
                      {format(parseISO(clinic.created_at), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-3 py-3.5 text-slate-300">
                      <ChevronDown size={14} className="-rotate-90" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ClinicDrawer
          clinic={selected}
          secret={secret}
          onClose={() => setSelected(null)}
          onPlanChanged={handlePlanChanged}
        />
      )}
    </div>
  );
}
