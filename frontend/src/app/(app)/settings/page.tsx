"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, Users, Copy, CheckCircle2, UserPlus, Tag, Plus, Pencil, Check, X, Trash2, GripVertical, Link2, Unlink, Download, Shield, History, CalendarDays, RefreshCw, ExternalLink, Unplug } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { useClinicSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useSyncCalendar, useCalendarStatus, useDisconnectGoogleOAuth } from "@/hooks/useCalendar";
import apiClient, { getAccessToken } from "@/lib/api-client";
import { useAllUsers, useCreateUser } from "@/hooks/useUsers";
import { useProcedures, useUpdateProcedurePrice, useCreateProcedure, useDeleteProcedure, useReorderProcedures, usePriceHistory, PriceHistoryEntry } from "@/hooks/useCatalog";
import { ClinicUser, UserRole, Procedure } from "@/types";
import { useCostTreatments, useCostProducts, useFixedCosts, useLinkCostProcedure } from "@/hooks/useCostos";
import { calculateTreatmentCosts, apiTreatmentToTreatment, apiProductToProduct } from "@/lib/costos-utils";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";

const ROLE_LABELS: Record<UserRole, string> = {
  clinic_owner: "Propietario",
  admin: "Administrador",
  dentist: "Dentista",
  receptionist: "Recepcionista",
  assistant: "Asistente",
};

const ROLE_COLORS: Record<UserRole, string> = {
  clinic_owner: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  dentist: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  receptionist: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  assistant: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "dentist", label: "Dentista" },
  { value: "receptionist", label: "Recepcionista" },
  { value: "assistant", label: "Asistente" },
];

const durationOptions = [
  { value: "15", label: "15 minutos" },
  { value: "20", label: "20 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "60 minutos" },
  { value: "90", label: "90 minutos" },
];

const currencyOptions = [
  { value: "NIO", label: "NIO — Córdoba Nicaragüense" },
  { value: "USD", label: "USD — Dólar Estadounidense" },
  { value: "HNL", label: "HNL — Lempira Hondureño" },
  { value: "GTQ", label: "GTQ — Quetzal Guatemalteco" },
];

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("dentist");
  const [phone, setPhone] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useCreateUser((result) => {
    setTempPassword(result.temp_password);
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      email: email.trim(),
      full_name: fullName.trim(),
      role,
      phone: phone.trim() || undefined,
    });
  }

  function handleCopy() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setEmail("");
    setFullName("");
    setRole("dentist");
    setPhone("");
    setTempPassword(null);
    setCopied(false);
    onClose();
  }

  if (tempPassword) {
    return (
      <Modal open={open} onClose={handleClose} title="Usuario creado" size="sm">
        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-full bg-green-50 dark:bg-green-900/30 w-14 h-14 mx-auto">
            <CheckCircle2 size={28} className="text-green-500 dark:text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-white">{fullName}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{email}</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 p-4">
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">Contraseña temporal (cópiala ahora):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-semibold text-slate-800 dark:text-white bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-2 break-all">
                {tempPassword}
              </code>
              <button
                onClick={handleCopy}
                className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
              >
                {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              El usuario deberá cambiarla en su primer inicio de sesión.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={handleClose}>Cerrar</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo usuario" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre completo *"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ej: Dra. María López"
          required
          autoFocus
        />
        <Input
          label="Correo electrónico *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@clinica.com"
          required
        />
        <Select
          label="Rol *"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={roleOptions}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Opcional"
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!fullName.trim() || !email.trim()}
            loading={create.isPending}
          >
            Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UserRow({ user }: { user: ClinicUser }) {
  const initials = user.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-sm font-semibold text-blue-700 dark:text-blue-300">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{user.full_name}</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{user.email}</p>
      </div>
      <div className="shrink-0">
        <Badge
          label={ROLE_LABELS[user.role]}
          className={ROLE_COLORS[user.role]}
        />
      </div>
      <div className="shrink-0 text-right">
        {user.last_login_at ? (
          <p className="text-xs text-slate-400 dark:text-gray-500">
            {format(parseISO(user.last_login_at), "d MMM yyyy", { locale: es })}
          </p>
        ) : (
          <p className="text-xs text-slate-300 dark:text-gray-600">Sin acceso</p>
        )}
      </div>
      <div className="shrink-0">
        <Badge
          label={user.is_active ? "Activo" : "Inactivo"}
          className={user.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading: loadingSettings } = useClinicSettings();
  const { data: users = [], isLoading: loadingUsers } = useAllUsers();
  const updateSettings = useUpdateSettings();
  const syncCalendar = useSyncCalendar();
  const disconnectOAuth = useDisconnectGoogleOAuth();
  const { data: calendarStatus, refetch: refetchStatus } = useCalendarStatus();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const google = searchParams.get("google");
    if (google === "connected") {
      toast.success("Google Calendar conectado correctamente.");
      refetchStatus();
      // Limpiar param de URL sin recargar
      window.history.replaceState({}, "", "/settings");
    } else if (google === "error") {
      toast.error("No se pudo conectar con Google Calendar. Intenta de nuevo.");
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clinic form state
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("NIO");
  const [duration, setDuration] = useState("30");
  const [exchangeRate, setExchangeRate] = useState("37");

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.display_name ?? "");
    setLegalName(settings.legal_name ?? "");
    setPhone(settings.phone ?? "");
    setEmail(settings.email ?? "");
    setAddress(settings.address_line1 ?? "");
    setCurrency(settings.currency_code ?? "NIO");
    setDuration(String(settings.default_appointment_duration_minutes ?? 30));
    setExchangeRate(String(settings.usd_exchange_rate ?? 37));
  }, [settings]);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    updateSettings.mutate({
      display_name: displayName.trim() || undefined,
      legal_name: legalName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address_line1: address.trim() || null,
      currency_code: currency,
      default_appointment_duration_minutes: Number(duration),
      usd_exchange_rate: Number(exchangeRate) || 37,
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-white">Configuración</h1>

      {/* Clinic info */}
      <section className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <Building2 size={16} className="text-slate-400 dark:text-gray-500" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Información de la clínica</h2>
        </div>

        {loadingSettings ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Nombre de la clínica *"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Clínica Dental SmileOS"
                required
              />
              <Input
                label="Razón social"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Nombre legal registrado"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Teléfono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+505 2222-3333"
              />
              <Input
                label="Correo de contacto"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@clinica.com"
              />
            </div>
            <Input
              label="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección de la clínica"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="Moneda"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={currencyOptions}
              />
              <Select
                label="Duración de cita predeterminada"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                options={durationOptions}
              />
              <Input
                label="Tasa de cambio (C$ por USD)"
                type="number"
                min="1"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="37.00"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={updateSettings.isPending}
                disabled={!displayName.trim()}
              >
                Guardar cambios
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Google Calendar */}
      <section className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <CalendarDays size={16} className="text-slate-400 dark:text-gray-500" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Google Calendar</h2>
          {calendarStatus?.oauth_connected ? (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium">
              OAuth conectado
            </span>
          ) : null}
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Conecta tu Google Calendar para sincronizar citas en ambas direcciones: las citas que crees en SmileOS aparecerán en Google Calendar, y las que tienes en Google Calendar se mostrarán en la agenda de SmileOS con sus colores.
          </p>

          {/* OAuth section */}
          {calendarStatus?.oauth_available !== false && (
            <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                    Sincronización bidireccional (recomendado)
                  </p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                    SmileOS crea citas en Google Calendar y lee los colores de cada evento.
                  </p>
                </div>
                {calendarStatus?.oauth_connected ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => syncCalendar.mutate()}
                      loading={syncCalendar.isPending}
                    >
                      <RefreshCw size={14} />
                      Sincronizar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={disconnectOAuth.isPending}
                      onClick={() => {
                        if (window.confirm("¿Desconectar Google Calendar?")) disconnectOAuth.mutate();
                      }}
                    >
                      <Unplug size={13} />
                      Desconectar
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await apiClient.get<{ data: { url: string } }>("/api/v1/calendar/oauth/authorize");
                        window.location.href = data.data.url;
                      } catch {
                        toast.error("No se pudo iniciar la conexión con Google.");
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Conectar con Google
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Users */}
      <section className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400 dark:text-gray-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Usuarios</h2>
          </div>
          <Button size="sm" onClick={() => setShowCreateUser(true)}>
            <UserPlus size={15} />
            Nuevo usuario
          </Button>
        </div>

        {loadingUsers ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </div>
        )}
      </section>

      <CreateUserModal
        open={showCreateUser}
        onClose={() => setShowCreateUser(false)}
      />

      <PriceCatalogSection />

      <BackupSection />
    </div>
  );
}

// ─── Catálogo de Precios ──────────────────────────────────────────────────────

function PriceHistoryModal({ proc, onClose }: { proc: Procedure; onClose: () => void }) {
  const { data: history = [], isLoading } = usePriceHistory(proc.id);

  function fmt(v: number | null) {
    if (v == null) return <span className="text-slate-400 dark:text-gray-500">sin precio</span>;
    return <span>C$ {Number(v).toLocaleString("es-NI", { minimumFractionDigits: 0 })}</span>;
  }

  return (
    <Modal open onClose={onClose} title={`Historial de precios — ${proc.name}`} size="md">
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-8">
          Sin cambios de precio registrados.
        </p>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100 dark:divide-gray-700">
          {history.map((entry: PriceHistoryEntry, i: number) => (
            <div key={entry.id} className="flex items-start gap-3 py-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 dark:text-blue-400 text-xs font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                    {fmt(entry.price_from)}
                  </span>
                  <span className="text-slate-400 dark:text-gray-500">→</span>
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {fmt(entry.price_to)}
                  </span>
                </div>
                {(entry.operational_cost_from != null || entry.operational_cost_to != null) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400 dark:text-gray-500">Costo op.:</span>
                    <span className="text-xs text-slate-500 dark:text-gray-400">{fmt(entry.operational_cost_from)}</span>
                    <span className="text-slate-300 dark:text-gray-600">→</span>
                    <span className="text-xs text-slate-600 dark:text-gray-300">{fmt(entry.operational_cost_to)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-gray-500">
                  <span>{format(parseISO(entry.date), "d MMM yyyy, HH:mm", { locale: es })}</span>
                  {entry.user && <span>· {entry.user}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EditableAmount({
  label,
  value,
  onSave,
  isPending,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value != null ? String(value) : "");

  function save() {
    const parsed = input.trim() === "" ? null : parseFloat(input);
    onSave(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400">C$</span>
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-24 rounded border border-blue-300 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={save} disabled={isPending} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400 mr-1">{label}</span>
      <span className="text-sm font-medium text-slate-800 dark:text-gray-200 w-24 text-right">
        {value != null
          ? `C$ ${Number(value).toLocaleString("es-NI", { minimumFractionDigits: 0 })}`
          : <span className="text-slate-400 dark:text-gray-500 font-normal text-xs">—</span>}
      </span>
      <button onClick={() => { setInput(value != null ? String(value) : ""); setEditing(true); }} className="text-slate-300 hover:text-blue-500 transition-colors">
        <Pencil size={13} />
      </button>
    </div>
  );
}

function PriceRow({ proc }: { proc: Procedure }) {
  const update = useUpdateProcedurePrice();
  const deleteProcedure = useDeleteProcedure();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(proc.name);
  const [showHistory, setShowHistory] = useState(false);
  const [linkingOpen, setLinkingOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const linkingRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: treatments = [] } = useCostTreatments();
  const { data: apiProducts = [] } = useCostProducts();
  const { data: fixedCosts } = useFixedCosts();

  const products = apiProducts.map(apiProductToProduct);
  const totalFijo = (fixedCosts?.items ?? []).reduce((s, i) => s + i.amount, 0);
  const perPaciente = (fixedCosts?.patients_per_month ?? 1) > 0 ? totalFijo / (fixedCosts?.patients_per_month ?? 1) : 0;

  useEffect(() => {
    if (!linkingOpen) return;
    function handleClick(e: MouseEvent) {
      if (linkingRef.current && !linkingRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setLinkingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [linkingOpen]);

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownH = Math.min(treatments.length * 44 + 40, 240);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= dropdownH ? rect.bottom + 4 : rect.top - dropdownH - 4;
    setDropdownPos({ top, left: rect.left });
    setLinkingOpen(true);
  }
  const linkProcedure = useLinkCostProcedure();
  const linkedTreatment = treatments.find((t) => t.procedure_catalog_id === proc.id);

  const calculatedOpCost = linkedTreatment
    ? calculateTreatmentCosts(apiTreatmentToTreatment(linkedTreatment), products, perPaciente).calculatedPrice
    : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: proc.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== proc.name) {
      update.mutate({ id: proc.id, name: trimmed });
    }
    setEditingName(false);
  }

  function handleDelete() {
    if (window.confirm(`¿Eliminar "${proc.name}" del catálogo?`)) {
      deleteProcedure.mutate(proc.id);
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        title="Arrastrar para ordenar"
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Nombre editable — fila completa */}
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameInput(proc.name); setEditingName(false); } }}
                className="flex-1 rounded border border-blue-300 dark:border-blue-500 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={saveName} disabled={update.isPending} className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50 shrink-0">
                <Check size={14} />
              </button>
              <button onClick={() => { setNameInput(proc.name); setEditingName(false); }} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-slate-700 dark:text-gray-300">{proc.name}</span>
              <button onClick={() => { setNameInput(proc.name); setEditingName(true); }} className="text-slate-300 hover:text-blue-500 transition-colors shrink-0">
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>

        {/* Controles — segunda línea */}
        <div className="flex items-center gap-4 flex-wrap">
        <EditableAmount
          label="Precio:"
          value={proc.default_price}
          onSave={(price) => update.mutate({ id: proc.id, price })}
          isPending={update.isPending}
        />
        <EditableAmount
          label="Costo op.:"
          value={calculatedOpCost ?? proc.operational_cost ?? null}
          onSave={(operational_cost) => update.mutate({ id: proc.id, operational_cost })}
          isPending={update.isPending}
        />
        {/* Vínculo con tratamiento de costos */}
        <div className="relative flex items-center gap-1.5">
          <span className="text-xs text-slate-400 shrink-0">Inventario:</span>
          {linkedTreatment ? (
            <div className="flex items-center gap-1">
              <button
                ref={triggerRef}
                onClick={() => linkingOpen ? setLinkingOpen(false) : openDropdown()}
                className="flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors max-w-[160px]"
                title={linkedTreatment.name}
              >
                <Link2 size={11} className="shrink-0" />
                <span className="truncate">{linkedTreatment.name}</span>
              </button>
              <button
                onClick={() => linkProcedure.mutate({ treatmentId: linkedTreatment.id, procedureCatalogId: null })}
                className="text-slate-300 hover:text-red-400 transition-colors"
                title="Desvincular"
              >
                <Unlink size={12} />
              </button>
            </div>
          ) : (
            <button
              ref={triggerRef}
              onClick={() => linkingOpen ? setLinkingOpen(false) : openDropdown()}
              className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Link2 size={11} />
              Vincular
            </button>
          )}
          {linkingOpen && (
            <div ref={linkingRef} style={{ top: dropdownPos.top, left: dropdownPos.left }} className="fixed z-50 w-56 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
              <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide border-b border-slate-100 dark:border-gray-700">
                Seleccionar tratamiento
              </p>
              <div className="max-h-48 overflow-y-auto">
                {treatments.length === 0 && (
                  <p className="px-3 py-3 text-xs text-slate-400 dark:text-gray-500">Sin tratamientos creados</p>
                )}
                {treatments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (linkedTreatment) linkProcedure.mutate({ treatmentId: linkedTreatment.id, procedureCatalogId: null });
                      linkProcedure.mutate({ treatmentId: t.id, procedureCatalogId: proc.id });
                      setLinkingOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${linkedTreatment?.id === t.id ? "text-blue-700 dark:text-blue-400 font-medium" : "text-slate-700 dark:text-gray-300"}`}
                  >
                    {linkedTreatment?.id === t.id && <Check size={12} className="text-blue-600 shrink-0" />}
                    <span className={linkedTreatment?.id === t.id ? "" : "pl-4"}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>{/* close linkingRef div */}

          <button
            onClick={() => setShowHistory(true)}
            className="text-slate-300 hover:text-blue-500 transition-colors ml-auto"
            title="Historial de precios"
          >
            <History size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteProcedure.isPending}
            className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Eliminar procedimiento"
          >
            <Trash2 size={14} />
          </button>
        </div>{/* close controls row */}
      </div>{/* close flex-1 */}

      {showHistory && <PriceHistoryModal proc={proc} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function AddProcedureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const create = useCreateProcedure(() => { setName(""); setPrice(""); setDuration("30"); onClose(); });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      default_price: price ? parseFloat(price) : null,
      default_duration_minutes: parseInt(duration) || 30,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo procedimiento" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre del procedimiento *" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Precio (C$)</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Duración (min)</label>
            <input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={create.isPending}>Agregar</Button>
        </div>
      </form>
    </Modal>
  );
}

function PriceCatalogSection() {
  const { data: procedures = [], isLoading } = useProcedures();
  const [items, setItems] = useState<Procedure[]>([]);
  const reorder = useReorderProcedures();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { setItems(procedures); }, [procedures]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    setItems(newOrder);
    reorder.mutate(newOrder.map((p) => p.id));
  }

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-slate-500 dark:text-gray-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Catálogo de Procedimientos y Precios</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Agregar procedimiento
        </Button>
      </div>
      <div className="flex items-center justify-between px-5 py-2 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700">
        <span className="text-xs text-slate-400 dark:text-gray-500">Arrastra el ícono <GripVertical size={11} className="inline" /> para ordenar. Clic en el lápiz para editar.</span>
        <div className="flex gap-6 text-xs font-semibold text-slate-400 dark:text-gray-500 pr-6">
          <span className="w-24 text-right">Precio</span>
          <span className="w-24 text-right">Costo operativo</span>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-slate-50 dark:divide-gray-700">
              {items.map((p) => <PriceRow key={p.id} proc={p} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <AddProcedureModal open={showAdd} onClose={() => setShowAdd(false)} />
    </section>
  );
}

function BackupSection() {
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload(format: "backup" | "json" | "photos" | "receipts") {
    const setLoading =
      format === "backup" ? setLoadingXlsx :
      format === "json" ? setLoadingJson :
      format === "photos" ? setLoadingPhotos :
      setLoadingReceipts;
    const ext = format === "backup" ? "xlsx" : format === "json" ? "json" : "zip";
    setLoading(true);
    setError("");
    try {
      const token = getAccessToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/v1/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smileos_backup_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("No se pudo descargar el respaldo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-700 px-6 py-4">
        <Shield size={16} className="text-slate-400 dark:text-gray-500" />
        <h2 className="font-semibold text-slate-800 dark:text-white">Respaldo de datos</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          <strong>Recomendación:</strong> Descarga un respaldo al menos una vez al mes y guárdalo en Drive o en tu computadora.
          El plan gratuito de la base de datos puede eliminar datos si la aplicación lleva 90 días sin uso.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-gray-600 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Excel (.xlsx)</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">Para revisar tus datos tú mismo, imprimir o compartir. 6 hojas: Pacientes, Finanzas, Productos, Lotes, Tratamientos, Citas.</p>
            <Button onClick={() => handleDownload("backup")} loading={loadingXlsx} variant="secondary" size="sm" className="w-full">
              <Download size={13} />
              {loadingXlsx ? "Generando…" : "Descargar Excel"}
            </Button>
          </div>

          <div className="rounded-xl border border-blue-200 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-900/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">JSON <span className="text-xs font-normal text-blue-600 dark:text-blue-400 ml-1">recomendado para IA</span></p>
            <p className="text-xs text-slate-500 dark:text-gray-400">Formato estructurado ideal para recuperación con IA. Incluye todos los datos y relaciones entre registros (paciente → evoluciones, producto → lotes).</p>
            <Button onClick={() => handleDownload("json")} loading={loadingJson} variant="secondary" size="sm" className="w-full">
              <Download size={13} />
              {loadingJson ? "Generando…" : "Descargar JSON"}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-gray-600 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Fotos de pacientes (.zip)</p>
            <p className="text-xs text-slate-500">Todas las fotos clínicas organizadas por carpeta de paciente.</p>
            <Button onClick={() => handleDownload("photos")} loading={loadingPhotos} variant="secondary" size="sm" className="w-full">
              <Download size={13} />
              {loadingPhotos ? "Generando…" : "Descargar fotos"}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-gray-600 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Facturas / recibos (.zip)</p>
            <p className="text-xs text-slate-500">Todas las facturas subidas, nombradas por fecha, paciente y descripción.</p>
            <Button onClick={() => handleDownload("receipts")} loading={loadingReceipts} variant="secondary" size="sm" className="w-full">
              <Download size={13} />
              {loadingReceipts ? "Generando…" : "Descargar facturas"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <p className="text-xs text-slate-400 dark:text-gray-500">
          El archivo JSON puede pegarse en una conversación de IA junto con la instrucción "restaura estos datos en SmileOS" para recuperación completa.
        </p>
      </div>
    </section>
  );
}
