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

export interface DashboardSummary {
  today: string;
  agenda: {
    date: string;
    total: number;
    completed: number;
    remaining: number;
    appointments: Appointment[];
    tomorrow_count: number;
  };
  alerts: {
    birthdays_today: Array<{ patient_id: string; patient_name: string; age: number }>;
    incomplete_records_count: number;
    urgent_treatments_without_appointment_count: number;
    patients_without_recent_visit_count: number;
  };
  metrics: {
    visible: boolean;
    month: string;
    patients_attended: number;
    total_appointments: number;
    no_show_rate: number;
    new_patients: number;
    attendance_rate: number;
    vs_last_month: {
      patients_attended_delta: number;
      no_show_rate_delta: number;
      attendance_rate_delta: number;
    };
  };
  rewards_distribution: {
    visible: boolean;
    total_active_patients: number;
    levels: Record<RewardsLevel, number>;
  };
}
