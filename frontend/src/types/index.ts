// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = "clinic_owner" | "admin" | "dentist" | "receptionist" | "assistant";

export interface AuthUser {
  id: string;
  clinic_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  must_change_password: boolean;
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export type RewardsLevel = "starter" | "bronze" | "silver" | "gold" | "diamond";

export const REWARDS_LEVEL_LABELS: Record<RewardsLevel, string> = {
  starter: "Starter",
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
  diamond: "Diamante",
};

export const REWARDS_LEVEL_COLORS: Record<RewardsLevel, string> = {
  starter: "bg-slate-100 text-slate-600",
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-gray-100 text-gray-600",
  gold: "bg-yellow-100 text-yellow-800",
  diamond: "bg-violet-100 text-violet-700",
};

// ─── Patients ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string | null;
  gender: "M" | "F" | "other" | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  rewards_level: RewardsLevel | null;
  created_at: string;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentType =
  | "primera_consulta"
  | "control"
  | "limpieza"
  | "extraccion"
  | "endodoncia"
  | "ortodoncia"
  | "protesis"
  | "cirugia"
  | "emergencia"
  | "otro";

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  primera_consulta: "Primera Consulta",
  control: "Control",
  limpieza: "Limpieza",
  extraccion: "Extracción",
  endodoncia: "Endodoncia",
  ortodoncia: "Ortodoncia",
  protesis: "Prótesis",
  cirugia: "Cirugía",
  emergencia: "Emergencia",
  otro: "Otro",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-rose-100 text-rose-600",
};

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_rewards_level: RewardsLevel | null;
  dentist_id: string;
  dentist_name: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  today: {
    total: number;
    scheduled: number;
    confirmed: number;
    in_progress: number;
    completed: number;
    no_show: number;
    cancelled: number;
  };
  last_7_days: {
    completed_appointments: number;
    new_patients: number;
  };
  patients: {
    total_active: number;
    new_this_month: number;
  };
  treatment_plans: {
    active: number;
    on_hold: number;
    completed: number;
    abandoned: number;
  };
  smile_rewards: {
    by_level: Record<RewardsLevel, number>;
    total_points_in_circulation: number;
  };
}

// ─── Patients (detail + list) ─────────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  rewards_level: RewardsLevel | null;
  rewards_points: number | null;
  first_visit_date: string | null;
  created_at: string;
}

export interface PatientDetail {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string | null;
  gender: "M" | "F" | "other" | null;
  id_number: string | null;
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  blood_type: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  referred_by_patient_id: string | null;
  is_active: boolean;
  first_visit_date: string | null;
  notes: string | null;
  rewards: {
    level: RewardsLevel;
    total_points: number;
    benefits_suspended: boolean;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface PatientFormValues {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "" | "M" | "F" | "other";
  id_number: string;
  phone: string;
  phone_secondary: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  blood_type: string;
  allergies: string;
  medical_conditions: string;
  current_medications: string;
  notes: string;
}

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  id_number: "",
  phone: "",
  phone_secondary: "",
  email: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  blood_type: "",
  allergies: "",
  medical_conditions: "",
  current_medications: "",
  notes: "",
};

export const GENDER_LABELS: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
  other: "Otro",
};

// ─── Treatments ───────────────────────────────────────────────────────────────

export type TreatmentPlanStatus = "active" | "on_hold" | "completed" | "abandoned";
export type TreatmentItemStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TreatmentItemPriority = "normal" | "urgent";

export interface TreatmentItem {
  id: string;
  procedure_id: string;
  procedure_name: string | null;
  procedure_code: string | null;
  status: TreatmentItemStatus;
  priority: TreatmentItemPriority;
  tooth_fdi: string | null;
  notes: string | null;
  quoted_price: number | null;
  sort_order: number;
  completed_at: string | null;
  completed_in_appointment_id: string | null;
  created_at: string;
}

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  created_by: { id: string; full_name: string } | null;
  title: string;
  diagnosis: string | null;
  status: TreatmentPlanStatus;
  notes: string | null;
  abandoned_reason: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  created_at: string;
  updated_at: string;
  items: TreatmentItem[];
}

export interface Procedure {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_duration_minutes: number | null;
  default_price: number | null;
  operational_cost: number | null;
  category: string | null;
  is_active: boolean;
  is_system: boolean;
}

export const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  active: "Activo",
  on_hold: "En espera",
  completed: "Completado",
  abandoned: "Abandonado",
};

export const PLAN_STATUS_COLORS: Record<TreatmentPlanStatus, string> = {
  active: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-slate-100 text-slate-500",
};

export const ITEM_STATUS_LABELS: Record<TreatmentItemStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const ITEM_STATUS_COLORS: Record<TreatmentItemStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-500",
};

// ─── Rewards ──────────────────────────────────────────────────────────────────

export interface RewardsAccount {
  id: string;
  patient_id: string;
  level: RewardsLevel;
  total_points: number;
  benefits_suspended: boolean;
  last_visit_date: string | null;
  level_updated_at: string | null;
  progress: {
    current_level: RewardsLevel;
    next_level: RewardsLevel | null;
    points_in_level: number;
    points_needed: number | null;
    progress_pct: number;
  };
}

export interface RewardsTransaction {
  id: string;
  transaction_type: string;
  points: number;
  balance_after: number;
  description: string | null;
  appointment_id: string | null;
  created_at: string;
}

export interface RewardsPointEntry {
  key: string;
  label: string;
  points: number;
  is_system: boolean;
  trigger: "auto" | "manual";
}

export interface RewardsLevelEntry {
  level: RewardsLevel;
  label: string;
  threshold: number;
  is_editable: boolean;
  discount_pct: number;
  perks: string[];
}

export interface RewardsConfig {
  points_table: RewardsPointEntry[];
  level_thresholds: RewardsLevelEntry[];
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ─── Appointments (full detail) ───────────────────────────────────────────────

export interface AppointmentFull {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_rewards_level: RewardsLevel | null;
  dentist_id: string;
  dentist_name: string;
  scheduled_at: string;
  end_at: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface ClinicUser {
  id: string;
  clinic_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export type PhotoType =
  | "profile"
  | "intraoral_frontal"
  | "intraoral_lateral_right"
  | "intraoral_lateral_left"
  | "extraoral_frontal"
  | "extraoral_profile"
  | "xray"
  | "other";

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  profile: "Perfil",
  intraoral_frontal: "Intraoral Frontal",
  intraoral_lateral_right: "Intraoral Lateral Der.",
  intraoral_lateral_left: "Intraoral Lateral Izq.",
  extraoral_frontal: "Extraoral Frontal",
  extraoral_profile: "Extraoral Perfil",
  xray: "Radiografía",
  other: "Otro",
};

export interface PatientPhoto {
  id: string;
  patient_id: string;
  photo_type: PhotoType;
  caption: string | null;
  appointment_id: string | null;
  taken_at: string | null;
  created_at: string;
}

// ─── Clinic Settings ──────────────────────────────────────────────────────────

export interface ClinicSettings {
  id: string;
  display_name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  default_appointment_duration: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleItem {
  id: string;
  scheduled_at: string;
  scheduled_at_local: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  patient: { id: string; full_name: string; phone: string | null };
  dentist: { id: string; full_name: string };
  reason: string | null;
}

// ─── Treatment Quote ──────────────────────────────────────────────────────────

export interface QuoteItem {
  id: string;
  toothNumber: number | null;
  procedureId: string;
  procedureName: string;
  price: number;
}

// ─── Odontogram ───────────────────────────────────────────────────────────────

export type ToothCondition =
  | "sano"
  | "caries"
  | "obturado"
  | "endodoncia"
  | "corona"
  | "extraccion_indicada"
  | "extraido"
  | "implante"
  | "fractura";

export const TOOTH_CONDITION_LABELS: Record<ToothCondition, string> = {
  sano: "Sano",
  caries: "Caries",
  obturado: "Obturado",
  endodoncia: "Endodoncia",
  corona: "Corona",
  extraccion_indicada: "Extracción indicada",
  extraido: "Extraído",
  implante: "Implante",
  fractura: "Fractura",
};

export const TOOTH_CONDITION_COLORS: Record<ToothCondition, { bg: string; border: string; text: string; symbol: string }> = {
  sano:                { bg: "bg-white",       border: "border-slate-400",  text: "text-slate-500",  symbol: "·"  },
  caries:              { bg: "bg-red-100",     border: "border-red-500",    text: "text-red-700",    symbol: "●"  },
  obturado:            { bg: "bg-blue-100",    border: "border-blue-500",   text: "text-blue-700",   symbol: "■"  },
  endodoncia:          { bg: "bg-purple-100",  border: "border-purple-600", text: "text-purple-700", symbol: "⊕"  },
  corona:              { bg: "bg-yellow-100",  border: "border-yellow-500", text: "text-yellow-800", symbol: "♛"  },
  extraccion_indicada: { bg: "bg-orange-100",  border: "border-orange-500", text: "text-orange-700", symbol: "↓"  },
  extraido:            { bg: "bg-slate-100",   border: "border-slate-400",  text: "text-slate-500",  symbol: "✕"  },
  implante:            { bg: "bg-green-100",   border: "border-green-600",  text: "text-green-700",  symbol: "⌇"  },
  fractura:            { bg: "bg-rose-100",    border: "border-rose-600",   text: "text-rose-800",   symbol: "⚡" },
};

export interface OdontogramTooth {
  id: string;
  tooth_number: number;
  condition: ToothCondition;
  notes: string | null;
  updated_at: string | null;
  updated_by: { id: string; full_name: string } | null;
}

export interface OdontogramSnapshot {
  id: string;
  created_at: string;
  snapshot_notes: string | null;
  teeth_data: Record<string, { condition: ToothCondition; notes: string | null }>;
  created_by: { id: string; full_name: string } | null;
}

// ─── Procedure (with operational_cost) ───────────────────────────────────────

export interface ProcedureFull {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_duration_minutes: number | null;
  default_price: number | null;
  operational_cost: number | null;
  category: string | null;
  is_active: boolean;
  is_system: boolean;
}

// ─── Finances ─────────────────────────────────────────────────────────────────

export type FinanceType = "ingreso" | "egreso";

export type IncomeCategory = "pago_tratamiento" | "otro_ingreso";
export type ExpenseCategory =
  | "laboratorio"
  | "insumos"
  | "renta"
  | "servicios"
  | "salario"
  | "otro_egreso";
export type FinanceCategory = IncomeCategory | ExpenseCategory;

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  pago_tratamiento: "Pago de tratamiento",
  otro_ingreso: "Otro ingreso",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  laboratorio: "Laboratorio dental",
  insumos: "Insumos y materiales",
  renta: "Renta",
  servicios: "Servicios (agua/luz/internet)",
  salario: "Salario / Honorarios",
  otro_egreso: "Otro egreso",
};

export const ALL_CATEGORY_LABELS: Record<FinanceCategory, string> = {
  ...INCOME_CATEGORY_LABELS,
  ...EXPENSE_CATEGORY_LABELS,
};

export interface FinanceTransaction {
  id: string;
  type: FinanceType;
  category: FinanceCategory;
  description: string;
  amount_cordobas: number;
  original_amount: number | null;
  original_currency: string | null;
  exchange_rate_used: number | null;
  patient: { id: string; full_name: string } | null;
  procedure: { id: string; name: string } | null;
  operational_cost_snapshot: number | null;
  invoice_number: string | null;
  transaction_date: string;
  notes: string | null;
  receipt_url: string | null;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
}

export interface FinanceSummary {
  ingresos_brutos: number;
  egresos: number;
  costos_operativos: number;
  ingreso_neto: number;
  ingreso_neto_con_op: number;
  count_ingresos: number;
  count_egresos: number;
}

export interface TransactionCreatePayload {
  type: FinanceType;
  category: FinanceCategory;
  description: string;
  original_amount: number;
  original_currency: "NIO" | "USD";
  patient_id?: string;
  procedure_id?: string;
  invoice_number?: string;
  transaction_date: string;
  notes?: string;
}
