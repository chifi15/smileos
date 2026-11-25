import { jsPDF } from "jspdf";
import autoTable, { type CellDef } from "jspdf-autotable";

// PDF del plan de tratamiento para entregar al paciente: procedimientos por pieza,
// costo por hemiarcada, costo total, opciones de pago con descuento, términos y firmas.

export interface PlanPdfItem {
  procedure_name: string | null;
  tooth_fdi: string | null;
  quoted_price: number | null;
  status: string;
}

export interface PlanPdfInput {
  clinic: {
    name: string;
    legalName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  patientName: string;
  doctorName?: string | null;
  plan: {
    title: string;
    diagnosis?: string | null;
    notes?: string | null;
    items: PlanPdfItem[];
  };
  /** Fecha de elaboración/entrega del plan (por defecto, hoy). */
  issuedAt?: Date;
}

// ─── Reglas comerciales ──────────────────────────────────────────────────────
export const DISCOUNT_FULL_PCT = 10;
export const DISCOUNT_HALF_PCT = 5;
export const VALIDITY_DAYS = 15;

// ─── Hemiarcadas (cuadrantes FDI) ────────────────────────────────────────────
type GroupKey = "sd" | "si" | "ii" | "id" | "multi" | "general";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "sd", label: "Hemiarcada superior derecha" },
  { key: "si", label: "Hemiarcada superior izquierda" },
  { key: "ii", label: "Hemiarcada inferior izquierda" },
  { key: "id", label: "Hemiarcada inferior derecha" },
  { key: "multi", label: "Más de una hemiarcada" },
  { key: "general", label: "General (sin pieza específica)" },
];

// Primer dígito FDI: 1/5 sup. derecha, 2/6 sup. izquierda, 3/7 inf. izquierda, 4/8 inf. derecha
const QUADRANT: Record<string, GroupKey> = {
  "1": "sd", "5": "sd",
  "2": "si", "6": "si",
  "3": "ii", "7": "ii",
  "4": "id", "8": "id",
};

export function groupForTooth(toothFdi: string | null): GroupKey {
  if (!toothFdi) return "general";
  const teeth = toothFdi.match(/[1-8][1-8]/g);
  if (!teeth || teeth.length === 0) return "general";
  const quadrants = new Set(teeth.map((t) => QUADRANT[t[0]]));
  return quadrants.size === 1 ? [...quadrants][0] : "multi";
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
const money = (n: number) =>
  `C$ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const longDate = (d: Date) => `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;

// Colores
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const ACCENT: [number, number, number] = [30, 64, 175];
const SOFT: [number, number, number] = [241, 245, 249];
const LINE: [number, number, number] = [203, 213, 225];

export function buildTreatmentPlanPdf(input: PlanPdfInput): jsPDF {
  const { clinic, plan } = input;
  const issued = input.issuedAt ?? new Date();
  const validUntil = new Date(issued);
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16; // margen
  const contentW = pageW - M * 2;
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Pasa a una página nueva si no queda espacio para "needed" mm
  let y = 0;
  const ensure = (needed: number) => {
    if (y + needed > pageH - 22) {
      doc.addPage();
      y = M;
    }
  };

  // ── Encabezado ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...ACCENT);
  doc.text(clinic.name || "Clínica", M, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const contact = [clinic.legalName, clinic.address, clinic.phone && `Tel: ${clinic.phone}`, clinic.email].filter(Boolean) as string[];
  contact.forEach((line, i) => doc.text(line, pageW - M, 11.5 + i * 3.9, { align: "right" }));

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(M, 27, pageW - M, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("PLAN DE TRATAMIENTO Y PRESUPUESTO", M, 37);

  // ── Datos del paciente ──
  const info: [string, string][] = [
    ["Paciente", input.patientName],
    ["Plan", plan.title],
    ["Fecha de elaboración", longDate(issued)],
    ["Vigente hasta", longDate(validUntil)],
  ];
  if (input.doctorName) info.push(["Doctor(a)", input.doctorName]);

  y = 43;
  doc.setFontSize(9.5);
  info.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(value, contentW - 42);
    doc.text(lines, M + 42, y);
    y += Math.max(1, lines.length) * 4.8;
  });

  if (plan.diagnosis) {
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text("Diagnóstico:", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(plan.diagnosis, contentW - 42);
    doc.text(lines, M + 42, y);
    y += lines.length * 4.8;
  }
  y += 4;

  // ── Tabla de procedimientos por hemiarcada ──
  const items = plan.items.filter((i) => i.status !== "cancelled");
  const byGroup = new Map<GroupKey, PlanPdfItem[]>();
  for (const it of items) {
    const k = groupForTooth(it.tooth_fdi);
    byGroup.set(k, [...(byGroup.get(k) ?? []), it]);
  }

  const body: CellDef[][] = [];
  let n = 0;
  let total = 0;
  for (const g of GROUPS) {
    const list = byGroup.get(g.key);
    if (!list || list.length === 0) continue;
    body.push([
      { content: g.label, colSpan: 4, styles: { fillColor: SOFT, fontStyle: "bold", textColor: ACCENT } },
    ]);
    let sub = 0;
    for (const it of list) {
      n += 1;
      const price = it.quoted_price ?? 0;
      sub += price;
      body.push([
        { content: String(n), styles: { halign: "center" } },
        { content: it.tooth_fdi?.trim() || "—", styles: { halign: "center" } },
        { content: it.procedure_name ?? "Procedimiento" },
        { content: it.quoted_price == null ? "—" : money(price), styles: { halign: "right" } },
      ]);
    }
    total += sub;
    body.push([
      { content: `Subtotal · ${g.label.toLowerCase()}`, colSpan: 3, styles: { halign: "right", fontStyle: "bold", textColor: MUTED } },
      { content: money(sub), styles: { halign: "right", fontStyle: "bold" } },
    ]);
  }

  if (body.length === 0) {
    body.push([{ content: "Este plan aún no tiene procedimientos.", colSpan: 4, styles: { halign: "center", textColor: MUTED } }]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 22 },
    head: [["#", "Pieza", "Procedimiento", "Costo"]],
    body,
    foot: [[
      { content: "COSTO TOTAL DEL PLAN", colSpan: 3, styles: { halign: "right" } },
      { content: money(total), styles: { halign: "right" } },
    ]],
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: INK, textColor: 255, fontStyle: "bold", fontSize: 10 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 22 }, 3: { cellWidth: 36 } },
  });
  y = lastY() + 9;

  // ── Opciones de pago ──
  ensure(48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Opciones de pago", M, y);
  y += 3;

  const full = total * (1 - DISCOUNT_FULL_PCT / 100);
  const half = total * (1 - DISCOUNT_HALF_PCT / 100);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 22 },
    head: [["Forma de pago", "Descuento", "Total a pagar", "Ahorro"]],
    body: [
      ["Pago completo del plan", `${DISCOUNT_FULL_PCT}%`, money(full), money(total - full)],
      ["Pago de la mitad del plan", `${DISCOUNT_HALF_PCT}%`, money(half), money(total - half)],
      ["Pago por tratamiento individual", "Sin descuento", money(total), money(0)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 36, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 30 },
    },
  });
  y = lastY() + 9;

  // ── Términos y condiciones ──
  const terms = [
    `Si el paciente paga el plan completo, se le otorga un ${DISCOUNT_FULL_PCT}% de descuento sobre el costo total.`,
    `Si el paciente paga la mitad del plan, se le otorga un ${DISCOUNT_HALF_PCT}% de descuento sobre el costo total.`,
    "Si el paciente paga por tratamiento individual, no se aplica ningún descuento.",
    `Los costos de este plan son vigentes por ${VALIDITY_DAYS} días a partir de la fecha de elaboración o entrega del plan (hasta el ${longDate(validUntil)}).`,
  ];
  if (plan.notes?.trim()) terms.push(plan.notes.trim());

  ensure(18 + terms.length * 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Términos y condiciones", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  terms.forEach((t, i) => {
    const lines = doc.splitTextToSize(t, contentW - 7);
    ensure(lines.length * 4.4 + 2);
    doc.setTextColor(...ACCENT);
    doc.text(`${i + 1}.`, M, y);
    doc.setTextColor(...INK);
    doc.text(lines, M + 7, y);
    y += lines.length * 4.4 + 2;
  });
  y += 4;

  // ── Aceptación y firmas ──
  ensure(58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Aceptación del plan", M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const accept = doc.splitTextToSize(
    "Declaro que se me ha explicado el plan de tratamiento y sus costos, y que estoy de acuerdo con las condiciones descritas.",
    contentW
  );
  doc.text(accept, M, y);
  y += accept.length * 4.4 + 18;

  const colW = (contentW - 14) / 2;
  const x2 = M + colW + 14;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + colW, y);
  doc.line(x2, y, x2 + colW, y);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Firma del paciente", M, y + 4.5);
  doc.text(input.patientName, M, y + 9);
  doc.text("Cédula / ID: ____________________", M, y + 14);
  doc.text("Firma del doctor(a)", x2, y + 4.5);
  if (input.doctorName) doc.text(input.doctorName, x2, y + 9);
  doc.text("Fecha: ____ / ____ / ________", x2, y + 14);

  // ── Pie de página ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, pageH - 14, pageW - M, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${clinic.name} · Plan de tratamiento de ${input.patientName}`, M, pageH - 9);
    doc.text(`Página ${p} de ${pages}`, pageW - M, pageH - 9, { align: "right" });
  }

  return doc;
}

export function downloadTreatmentPlanPdf(input: PlanPdfInput) {
  const doc = buildTreatmentPlanPdf(input);
  const safe = input.patientName.replace(/[\\/:*?"<>|]/g, "").trim() || "paciente";
  doc.save(`Plan de tratamiento - ${safe}.pdf`);
}
