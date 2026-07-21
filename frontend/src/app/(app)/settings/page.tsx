"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, Users, Copy, CheckCircle2, UserPlus, Tag, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { useClinicSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useAllUsers, useCreateUser } from "@/hooks/useUsers";
import { useProcedures, useUpdateProcedurePrice, useCreateProcedure, useDeleteProcedure } from "@/hooks/useCatalog";
import { ClinicUser, UserRole, Procedure } from "@/types";
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
  clinic_owner: "bg-violet-100 text-violet-700",
  admin: "bg-blue-100 text-blue-700",
  dentist: "bg-green-100 text-green-700",
  receptionist: "bg-amber-100 text-amber-700",
  assistant: "bg-slate-100 text-slate-600",
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
          <div className="flex items-center justify-center rounded-full bg-green-50 w-14 h-14 mx-auto">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-800">{fullName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{email}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-2">Contraseña temporal (cópiala ahora):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-semibold text-slate-800 bg-white rounded-lg border border-slate-200 px-3 py-2 break-all">
                {tempPassword}
              </code>
              <button
                onClick={handleCopy}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-600">
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{user.full_name}</p>
        <p className="text-xs text-slate-400 truncate">{user.email}</p>
      </div>
      <div className="shrink-0">
        <Badge
          label={ROLE_LABELS[user.role]}
          className={ROLE_COLORS[user.role]}
        />
      </div>
      <div className="shrink-0 text-right">
        {user.last_login_at ? (
          <p className="text-xs text-slate-400">
            {format(parseISO(user.last_login_at), "d MMM yyyy", { locale: es })}
          </p>
        ) : (
          <p className="text-xs text-slate-300">Sin acceso</p>
        )}
      </div>
      <div className="shrink-0">
        <Badge
          label={user.is_active ? "Activo" : "Inactivo"}
          className={user.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading: loadingSettings } = useClinicSettings();
  const { data: users = [], isLoading: loadingUsers } = useAllUsers();
  const updateSettings = useUpdateSettings();
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Clinic form state
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("NIO");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.display_name ?? "");
    setLegalName(settings.legal_name ?? "");
    setPhone(settings.phone ?? "");
    setEmail(settings.email ?? "");
    setAddress(settings.address ?? "");
    setCurrency(settings.currency ?? "NIO");
    setDuration(String(settings.default_appointment_duration ?? 30));
  }, [settings]);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    updateSettings.mutate({
      display_name: displayName.trim(),
      legal_name: legalName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      currency,
      default_appointment_duration: Number(duration),
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-800">Configuración</h1>

      {/* Clinic info */}
      <section className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
          <Building2 size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-800">Información de la clínica</h2>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Users */}
      <section className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">Usuarios</h2>
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
          <div className="py-10 text-center text-sm text-slate-400">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
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
    </div>
  );
}

// ─── Catálogo de Precios ──────────────────────────────────────────────────────

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
          className="w-24 rounded border border-blue-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={save} disabled={isPending} className="text-green-600 hover:text-green-700 disabled:opacity-50">
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
      <span className="text-sm font-medium text-slate-800 w-24 text-right">
        {value != null
          ? `C$ ${Number(value).toLocaleString("es-NI", { minimumFractionDigits: 0 })}`
          : <span className="text-slate-400 font-normal text-xs">—</span>}
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
    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors gap-4">
      {/* Nombre editable */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {editingName ? (
          <>
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameInput(proc.name); setEditingName(false); } }}
              className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={saveName} disabled={update.isPending} className="text-green-600 hover:text-green-700 disabled:opacity-50 shrink-0">
              <Check size={14} />
            </button>
            <button onClick={() => { setNameInput(proc.name); setEditingName(false); }} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-slate-700 truncate">{proc.name}</span>
            <button onClick={() => { setNameInput(proc.name); setEditingName(true); }} className="text-slate-300 hover:text-blue-500 transition-colors shrink-0">
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>
      {/* Precio y costo */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <EditableAmount
          label="Precio:"
          value={proc.default_price}
          onSave={(price) => update.mutate({ id: proc.id, price })}
          isPending={update.isPending}
        />
        <EditableAmount
          label="Costo op.:"
          value={proc.operational_cost ?? null}
          onSave={(operational_cost) => update.mutate({ id: proc.id, operational_cost })}
          isPending={update.isPending}
        />
        <button
          onClick={handleDelete}
          disabled={deleteProcedure.isPending}
          className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
          title="Eliminar procedimiento"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Precio (C$)</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duración (min)</label>
            <input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">Catálogo de Procedimientos y Precios</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Agregar procedimiento
        </Button>
      </div>
      <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-xs text-slate-400">Haz clic en el lápiz para editar. Enter para guardar.</span>
        <div className="flex gap-6 text-xs font-semibold text-slate-400 pr-6">
          <span className="w-24 text-right">Precio</span>
          <span className="w-24 text-right">Costo operativo</span>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="divide-y divide-slate-50">
          {procedures.map((p) => <PriceRow key={p.id} proc={p} />)}
        </div>
      )}
      <AddProcedureModal open={showAdd} onClose={() => setShowAdd(false)} />
    </section>
  );
}
