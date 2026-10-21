"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, CalendarCheck, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://smileos.onrender.com";

const http = axios.create({ baseURL: API });

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const APPOINTMENT_TYPES = [
  { value: "primera_consulta", label: "Primera Consulta" },
  { value: "control", label: "Control" },
  { value: "limpieza", label: "Limpieza" },
  { value: "extraccion", label: "Extracción" },
  { value: "endodoncia", label: "Endodoncia" },
  { value: "ortodoncia", label: "Ortodoncia" },
  { value: "protesis", label: "Prótesis" },
  { value: "cirugia", label: "Cirugía" },
  { value: "emergencia", label: "Emergencia" },
  { value: "otro", label: "Otro" },
];

interface ClinicInfo {
  clinic_name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  default_duration: number;
  slot_size: number;
  working_days: { day: number; is_working: boolean }[];
  dentists: { id: string; name: string }[];
}

interface SlotsData {
  slots: string[];
}

type Step = "calendar" | "slots" | "form" | "done";

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return `${DAYS_ES[weekday]} ${d} de ${MONTHS_ES[m - 1]} ${y}`;
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("calendar");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [apptType, setApptType] = useState("primera_consulta");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmedData, setConfirmedData] = useState<{ dentist: string; date: string; time: string } | null>(null);

  useEffect(() => {
    http.get(`/api/v1/booking/${slug}`)
      .then((r) => setClinic(r.data.data))
      .catch((err) => {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        if (status === 404) {
          setErrorMsg(detail ?? "Clínica no encontrada");
        } else if (!err?.response) {
          setErrorMsg(`Error de red — no se pudo conectar al servidor (${API})`);
        } else {
          setErrorMsg(`Error ${status}: ${detail ?? err.message}`);
        }
        setNotFound(true);
      })
      .finally(() => setLoadingClinic(false));
  }, [slug]);

  const workingDaySet = new Set(
    (clinic?.working_days ?? []).filter((d) => d.is_working).map((d) => d.day)
  );

  function isSelectableDay(y: number, m: number, d: number) {
    const dt = new Date(y, m, d);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (dt < todayMidnight) return false;
    return workingDaySet.has(dt.getDay());
  }

  async function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setStep("slots");
    try {
      const r = await http.get(`/api/v1/booking/${slug}/slots`, { params: { date: dateStr } });
      setSlots((r.data.data as SlotsData).slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleSelectSlot(slot: string) {
    setSelectedSlot(slot);
    setStep("form");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await http.post(`/api/v1/booking/${slug}/request`, {
        date: selectedDate,
        time: selectedSlot,
        guest_name: name.trim(),
        guest_phone: phone.trim(),
        appointment_type: apptType,
        reason: reason.trim(),
      });
      setConfirmedData({
        dentist: r.data.data.dentist_name,
        date: selectedDate!,
        time: selectedSlot!,
      });
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al reservar. Intenta de nuevo.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Calendar grid ──────────────────────────────────────────────────────────
  function buildCalendar() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingClinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound || !clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 p-6">
        <AlertCircle size={40} className="text-slate-300" />
        <p className="text-slate-500 text-center font-medium">Enlace de reserva no encontrado.</p>
        {errorMsg && (
          <p className="text-xs text-slate-400 text-center max-w-xs bg-slate-100 rounded-lg px-3 py-2 font-mono">
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  const calendar = buildCalendar();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <CalendarCheck size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{clinic.clinic_name}</h1>
          <p className="text-slate-500 text-sm mt-1">Reserva tu cita en línea</p>
          {clinic.city && <p className="text-slate-400 text-xs mt-0.5">{clinic.city}</p>}
        </div>

        {/* Step: Done */}
        {step === "done" && confirmedData && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 size={52} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Cita reservada!</h2>
            <p className="text-slate-500 text-sm mb-6">Te esperamos en {clinic.clinic_name}</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha</span>
                <span className="font-medium text-slate-800">{formatDate(confirmedData.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hora</span>
                <span className="font-medium text-slate-800">{confirmedData.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dentista</span>
                <span className="font-medium text-slate-800">{confirmedData.dentist}</span>
              </div>
            </div>
            {clinic.phone && (
              <p className="text-xs text-slate-400 mt-4">
                ¿Necesitas cambiar? Llámanos al {clinic.phone}
              </p>
            )}
          </div>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <button
              onClick={() => { setStep("slots"); setSelectedSlot(null); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
            >
              <ChevronLeft size={15} /> Volver
            </button>
            <div className="bg-blue-50 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <Clock size={16} className="text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">{formatDate(selectedDate!)}</p>
                <p className="text-xs text-blue-600">{selectedSlot} · {clinic.default_duration} min</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 8888-0000"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de consulta</label>
                <select
                  value={apptType}
                  onChange={(e) => setApptType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motivo (opcional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="¿Qué te trae por aquí?"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              {submitError && (
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={13} /> {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirmar cita
              </button>
            </form>
          </div>
        )}

        {/* Step: Slots */}
        {step === "slots" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <button
              onClick={() => setStep("calendar")}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
            >
              <ChevronLeft size={15} /> Volver al calendario
            </button>
            <p className="text-sm font-semibold text-slate-700 mb-4">{formatDate(selectedDate!)}</p>
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin text-blue-400" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay horarios disponibles ese día.</p>
                <button onClick={() => setStep("calendar")} className="mt-3 text-xs text-blue-500 hover:underline">
                  Elegir otro día
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleSelectSlot(slot)}
                    className="h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Calendar */}
        {step === "calendar" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={prevMonth}
                disabled={!canPrevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-slate-800 text-sm">
                {MONTHS_ES[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS_ES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {calendar.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = isoDate(viewYear, viewMonth, day);
                const selectable = isSelectableDay(viewYear, viewMonth, day);
                const isSelected = selectedDate === dateStr;
                const isToday =
                  day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();

                return (
                  <button
                    key={i}
                    disabled={!selectable}
                    onClick={() => selectable && handleSelectDate(dateStr)}
                    className={[
                      "mx-auto w-9 h-9 rounded-xl text-sm font-medium transition-colors flex items-center justify-center",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : selectable
                        ? "hover:bg-blue-50 text-slate-800 hover:text-blue-700" + (isToday ? " ring-2 ring-blue-300" : "")
                        : "text-slate-300 cursor-default",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              Selecciona un día disponible para ver los horarios
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
