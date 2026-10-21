"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Clock, CalendarCheck, CheckCircle2,
  Loader2, AlertCircle, User, Sun, Moon,
} from "lucide-react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://smileos.onrender.com";
const http = axios.create({ baseURL: API });

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Dentist  { id: string; name: string }
interface ClinicInfo {
  clinic_name: string; slug: string; phone: string | null;
  address: string | null; city: string | null;
  default_duration: number; slot_size: number;
  working_days: { day: number; is_working: boolean }[];
  dentists: Dentist[];
  appointment_types: { value: string; label: string }[];
}
interface SlotsData { slots: string[] }
type Step = "doctor" | "calendar" | "slots" | "form" | "done";

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_ES[dow]} ${d} de ${MONTHS_ES[m - 1]} ${y}`;
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [dark, setDark] = useState(true);

  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDentist, setSelectedDentist] = useState<Dentist | null>(null);
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [slots, setSlots]                     = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots]       = useState(false);
  const [selectedSlot, setSelectedSlot]       = useState<string | null>(null);
  const [step, setStep]                       = useState<Step>("doctor");

  const [name,        setName]        = useState("");
  const [phone,       setPhone]       = useState("");
  const [apptType,    setApptType]    = useState("primera_consulta");
  const [reason,      setReason]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmed, setConfirmed]     = useState<{ dentist: string; date: string; time: string } | null>(null);

  useEffect(() => {
    http.get(`/api/v1/booking/${slug}`)
      .then((r) => setClinic(r.data.data))
      .catch((err) => {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        if (status === 404)       setErrorMsg(detail ?? "Clínica no encontrada");
        else if (!err?.response)  setErrorMsg(`Error de red — no se pudo conectar al servidor (${API})`);
        else                      setErrorMsg(`Error ${status}: ${detail ?? err.message}`);
        setNotFound(true);
      })
      .finally(() => setLoadingClinic(false));
  }, [slug]);

  const workingDaySet = new Set(
    (clinic?.working_days ?? []).filter((d) => d.is_working).map((d) => d.day)
  );

  function isSelectableDay(y: number, m: number, d: number) {
    const dt = new Date(y, m, d);
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dt >= todayMid && workingDaySet.has(dt.getDay());
  }

  function handleChooseDentist(dentist: Dentist | null) {
    setSelectedDentist(dentist);
    setStep("calendar");
  }

  async function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setStep("slots");
    try {
      const params: Record<string, string> = { date: dateStr };
      if (selectedDentist) params.dentist_id = selectedDentist.id;
      const r = await http.get(`/api/v1/booking/${slug}/slots`, { params });
      setSlots((r.data.data as SlotsData).slots);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }

  function handleSelectSlot(slot: string) { setSelectedSlot(slot); setStep("form"); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await http.post(`/api/v1/booking/${slug}/request`, {
        date: selectedDate, time: selectedSlot,
        guest_name: name.trim(), guest_phone: phone.trim(),
        appointment_type: apptType, reason: reason.trim(),
        dentist_id: selectedDentist?.id ?? null,
      });
      setConfirmed({ dentist: r.data.data.dentist_name, date: selectedDate!, time: selectedSlot! });
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al reservar. Intenta de nuevo.";
      setSubmitError(msg);
    } finally { setSubmitting(false); }
  }

  function buildCalendar() {
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  const canPrevMonth = viewYear > today.getFullYear() || viewMonth > today.getMonth();
  function prevMonth() {
    if (!canPrevMonth) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── Clases reutilizables según modo ─────────────────────────────────────────
  const bg     = dark ? "bg-gray-950"      : "bg-gradient-to-br from-blue-50 to-slate-100";
  const card   = dark ? "bg-gray-900 border-gray-700"  : "bg-white border-slate-200";
  const text   = dark ? "text-white"       : "text-slate-800";
  const sub    = dark ? "text-gray-400"    : "text-slate-500";
  const muted  = dark ? "text-gray-500"    : "text-slate-400";
  const input  = dark
    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-blue-500"
    : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-blue-400";
  const divider = dark ? "divide-gray-700" : "divide-slate-100";
  const slotBtn = dark
    ? "border-gray-600 text-gray-200 hover:border-blue-400 hover:bg-blue-900/40 hover:text-blue-300"
    : "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700";
  const backBtn = dark ? "text-gray-400 hover:text-gray-200" : "text-slate-500 hover:text-slate-700";
  const dentistRow = dark
    ? "border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
    : "border-slate-200 hover:border-blue-400 hover:bg-blue-50";

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loadingClinic) return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-gray-950" : "bg-slate-50"}`}>
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  if (notFound || !clinic) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-3 p-6 ${dark ? "bg-gray-950" : "bg-slate-50"}`}>
      <AlertCircle size={40} className="text-slate-400" />
      <p className={`font-medium text-center ${dark ? "text-gray-300" : "text-slate-500"}`}>Enlace de reserva no encontrado.</p>
      {errorMsg && <p className={`text-xs text-center max-w-xs rounded-lg px-3 py-2 font-mono ${dark ? "bg-gray-800 text-gray-400" : "bg-slate-100 text-slate-400"}`}>{errorMsg}</p>}
    </div>
  );

  const calendar    = buildCalendar();
  const dentistLabel = selectedDentist ? selectedDentist.name : "Cualquier dentista";

  return (
    <div className={`min-h-screen flex flex-col items-center py-10 px-4 transition-colors ${bg}`}>
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8 relative">
          <button
            onClick={() => setDark(d => !d)}
            className={`absolute right-0 top-0 p-2 rounded-lg transition-colors ${dark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200"}`}
            title={dark ? "Modo claro" : "Modo oscuro"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <CalendarCheck size={26} className="text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${text}`}>{clinic.clinic_name}</h1>
          <p className={`text-sm mt-1 ${sub}`}>Reserva tu cita en línea</p>
          {clinic.city && <p className={`text-xs mt-0.5 ${muted}`}>{clinic.city}</p>}
        </div>

        {/* ── Confirmación ─────────────────────────────────────────────────── */}
        {step === "done" && confirmed && (
          <div className={`rounded-2xl shadow-sm border p-8 text-center ${card}`}>
            <CheckCircle2 size={52} className="text-green-500 mx-auto mb-4" />
            <h2 className={`text-xl font-bold mb-2 ${text}`}>¡Cita reservada!</h2>
            <p className={`text-sm mb-6 ${sub}`}>Te esperamos en {clinic.clinic_name}</p>
            <div className={`rounded-xl p-4 text-left space-y-2 text-sm ${dark ? "bg-gray-800" : "bg-slate-50"}`}>
              {[
                ["Fecha",    formatDate(confirmed.date)],
                ["Hora",     confirmed.time],
                ["Dentista", confirmed.dentist],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className={sub}>{label}</span>
                  <span className={`font-medium ${text}`}>{value}</span>
                </div>
              ))}
            </div>
            {clinic.phone && <p className={`text-xs mt-4 ${muted}`}>¿Necesitas cambiar? Llámanos al {clinic.phone}</p>}
          </div>
        )}

        {/* ── Formulario ───────────────────────────────────────────────────── */}
        {step === "form" && (
          <div className={`rounded-2xl shadow-sm border p-6 ${card}`}>
            <button onClick={() => { setStep("slots"); setSelectedSlot(null); }} className={`flex items-center gap-1 text-sm mb-4 ${backBtn}`}>
              <ChevronLeft size={15} /> Volver
            </button>
            <div className={`rounded-xl px-4 py-3 mb-5 space-y-1 ${dark ? "bg-blue-950/60 border border-blue-800/40" : "bg-blue-50"}`}>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-blue-400 shrink-0" />
                <p className={`text-sm font-semibold ${dark ? "text-blue-200" : "text-blue-800"}`}>{formatDate(selectedDate!)} · {selectedSlot}</p>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-blue-400 shrink-0" />
                <p className={`text-xs ${dark ? "text-blue-300" : "text-blue-600"}`}>{dentistLabel}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: "Nombre completo *", type: "text",  value: name,  set: setName,  ph: "Tu nombre completo", req: true },
                { label: "Teléfono",          type: "tel",   value: phone, set: setPhone, ph: "Ej: 8888-0000",      req: false },
              ].map(({ label, type, value, set, ph, req }) => (
                <div key={label}>
                  <label className={`block text-xs font-medium mb-1 ${dark ? "text-gray-300" : "text-slate-600"}`}>{label}</label>
                  <input
                    required={req}
                    type={type}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={ph}
                    className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 ${input}`}
                  />
                </div>
              ))}
              <div>
                <label className={`block text-xs font-medium mb-1 ${dark ? "text-gray-300" : "text-slate-600"}`}>Tipo de consulta</label>
                <select
                  value={apptType}
                  onChange={(e) => setApptType(e.target.value)}
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 ${input}`}
                >
                  {(clinic.appointment_types ?? []).map((t) => (
                    <option key={t.value} value={t.value}
                      className={dark ? "bg-gray-800 text-white" : "bg-white text-slate-800"}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${dark ? "text-gray-300" : "text-slate-600"}`}>Motivo (opcional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="¿Qué te trae por aquí?"
                  rows={2}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${input}`}
                />
              </div>
              {submitError && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={13} /> {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Confirmar cita
              </button>
            </form>
          </div>
        )}

        {/* ── Slots ────────────────────────────────────────────────────────── */}
        {step === "slots" && (
          <div className={`rounded-2xl shadow-sm border p-6 ${card}`}>
            <button onClick={() => setStep("calendar")} className={`flex items-center gap-1 text-sm mb-4 ${backBtn}`}>
              <ChevronLeft size={15} /> Volver al calendario
            </button>
            <p className={`text-sm font-semibold mb-1 ${text}`}>{formatDate(selectedDate!)}</p>
            <p className={`text-xs mb-4 flex items-center gap-1 ${muted}`}><User size={12} /> {dentistLabel}</p>
            {loadingSlots ? (
              <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-400" /></div>
            ) : slots.length === 0 ? (
              <div className={`text-center py-8 ${muted}`}>
                <Clock size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay horarios disponibles ese día.</p>
                <button onClick={() => setStep("calendar")} className="mt-3 text-xs text-blue-400 hover:underline">Elegir otro día</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleSelectSlot(slot)}
                    className={`h-10 rounded-xl border text-sm font-medium transition-colors ${slotBtn}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Calendario ───────────────────────────────────────────────────── */}
        {step === "calendar" && (
          <div className={`rounded-2xl shadow-sm border p-6 ${card}`}>
            <button onClick={() => setStep("doctor")} className={`flex items-center gap-1 text-sm mb-4 ${backBtn}`}>
              <ChevronLeft size={15} /> Cambiar dentista
            </button>
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-4 ${dark ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-600"}`}>
              <User size={13} className="shrink-0" /><span>{dentistLabel}</span>
            </div>
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth} disabled={!canPrevMonth} className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-slate-100"}`}>
                <ChevronLeft size={18} />
              </button>
              <span className={`font-semibold text-sm ${text}`}>{MONTHS_ES[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className={`p-1.5 rounded-lg transition-colors ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-slate-100"}`}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {DAYS_ES.map((d) => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${muted}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendar.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr   = isoDate(viewYear, viewMonth, day);
                const selectable = isSelectableDay(viewYear, viewMonth, day);
                const isSelected = selectedDate === dateStr;
                const isToday   = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                return (
                  <button
                    key={i}
                    disabled={!selectable}
                    onClick={() => selectable && handleSelectDate(dateStr)}
                    className={[
                      "mx-auto w-9 h-9 rounded-xl text-sm font-medium transition-colors flex items-center justify-center",
                      isSelected   ? "bg-blue-600 text-white shadow-sm"
                      : selectable ? (dark
                          ? `text-gray-200 hover:bg-blue-800/50 hover:text-blue-300${isToday ? " ring-2 ring-blue-500" : ""}`
                          : `text-slate-800 hover:bg-blue-50 hover:text-blue-700${isToday ? " ring-2 ring-blue-300" : ""}`)
                      : (dark ? "text-gray-700 cursor-default" : "text-slate-300 cursor-default"),
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className={`text-xs text-center mt-4 ${muted}`}>Selecciona un día disponible para ver los horarios</p>
          </div>
        )}

        {/* ── Selección de dentista ─────────────────────────────────────────── */}
        {step === "doctor" && (
          <div className={`rounded-2xl shadow-sm border p-6 ${card}`}>
            <h2 className={`text-base font-semibold mb-1 ${text}`}>¿Con quién deseas tu cita?</h2>
            <p className={`text-xs mb-5 ${muted}`}>Elige un dentista o deja que asignemos uno disponible</p>
            <div className="space-y-2">
              <button
                onClick={() => handleChooseDentist(null)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors text-left ${dentistRow}`}
              >
                <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${dark ? "bg-gray-700" : "bg-slate-100"}`}>
                  <User size={17} className={muted} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${text}`}>Cualquier dentista disponible</p>
                  <p className={`text-xs ${muted}`}>El primero disponible para tu horario</p>
                </div>
              </button>
              {clinic.dentists.map((d) => {
                const initials = d.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                return (
                  <button
                    key={d.id}
                    onClick={() => handleChooseDentist(d)}
                    className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors text-left ${dentistRow}`}
                  >
                    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${dark ? "bg-blue-900/60 text-blue-300" : "bg-blue-100 text-blue-700"}`}>
                      {initials}
                    </div>
                    <p className={`text-sm font-medium ${text}`}>{d.name}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
