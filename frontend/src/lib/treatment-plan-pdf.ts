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

export interface PdfPhoto {
  dataUrl: string; // JPEG
  width: number;
  height: number;
  label?: string;
}

export interface PlanPdfPhotos {
  /** Fotos generales (sonrisa, laterales, oclusales…) mostradas antes de la tabla. */
  overview: PdfPhoto[];
  /** Foto (recortada) para mostrar bajo el encabezado de cada hemiarcada. */
  byGroup: Partial<Record<string, PdfPhoto>>;
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
  photos?: PlanPdfPhotos;
  /** Mostrar precios, descuentos y totales (por defecto sí). */
  showPrices?: boolean;
}

// ─── Reglas comerciales ──────────────────────────────────────────────────────
export const DISCOUNT_FULL_PCT = 10;
export const DISCOUNT_HALF_PCT = 5;
export const VALIDITY_DAYS = 15;

import { GROUPS, groupForTooth, type GroupKey } from "@/lib/plan-groups";
export { GROUPS, groupForTooth };
export type { GroupKey };

// ─── Notación FDI con punto (1.1, 2.6…) ──────────────────────────────────────
/** "16, 26" → "1.6, 2.6" */
export const fdiDot = (v: string | null | undefined) =>
  (v ?? "").replace(/([1-8])([1-8])/g, "$1.$2");

// Ancho relativo de cada diente (1 = central … 8 = tercer molar) para repartirlos en la arcada
const TOOTH_W: Record<number, number> = { 1: 8, 2: 6.5, 3: 7.5, 4: 7, 5: 7, 6: 10, 7: 9.5, 8: 9 };

/** Dibuja la guía de piezas FDI (vista oclusal) resaltando las piezas del plan. */
function drawToothChart(
  doc: jsPDF,
  x0: number,
  y0: number,
  width: number,
  marked: Set<string>,
  colors: { ink: [number, number, number]; muted: [number, number, number]; accent: [number, number, number]; line: [number, number, number] },
): number {
  const a = Math.min(40, width / 2 - 12); // semieje horizontal (arcada angosta)
  const b = 46; // profundidad de la arcada (alargada)
  const cx = x0 + width / 2;
  const r = 4.6; // radio máx. de los círculos

  const arch = (nums: number[], baseY: number, up: boolean) => {
    // Longitud acumulada de la semielipse (muestreo)
    const N = 400;
    const pts: { x: number; y: number; len: number }[] = [];
    let len = 0;
    for (let i = 0; i <= N; i++) {
      const t = Math.PI - (Math.PI * i) / N;
      const x = cx + a * Math.cos(t);
      const y = up ? baseY - b * Math.sin(t) : baseY + b * Math.sin(t);
      if (i > 0) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
      pts.push({ x, y, len });
    }
    const widths = nums.map((n) => TOOTH_W[n % 10]);
    const totalW = widths.reduce((s, w) => s + w, 0);
    let acc = 0;
    nums.forEach((n, i) => {
      const mid = ((acc + widths[i] / 2) / totalW) * len;
      acc += widths[i];
      const p = pts.find((q) => q.len >= mid) ?? pts[N];
      const rad = Math.min(r, ((widths[i] / totalW) * len * 0.92) / 2);
      const isMarked = marked.has(String(n));
      doc.setLineWidth(isMarked ? 0.5 : 0.25);
      doc.setDrawColor(...(isMarked ? colors.accent : colors.line));
      doc.setFillColor(...(isMarked ? colors.accent : ([255, 255, 255] as [number, number, number])));
      doc.circle(p.x, p.y, rad, "FD");
      doc.setFont("helvetica", isMarked ? "bold" : "normal");
      doc.setFontSize(isMarked ? 6.6 : 6.2);
      doc.setTextColor(...(isMarked ? ([255, 255, 255] as [number, number, number]) : colors.ink));
      doc.text(`${Math.floor(n / 10)}.${n % 10}`, p.x, p.y + 0.9, { align: "center" });
    });
  };

  const upperTop = y0 + 6;
  const upperBase = upperTop + b + r; // línea base (extremos) de la arcada superior
  arch([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], upperBase, true);
  const lowerTop = upperBase + r + 9;
  arch([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38], lowerTop, false);
  const bottom = lowerTop + b + r;

  // Etiquetas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.muted);
  doc.text("SUPERIOR", cx, upperBase - b * 0.45, { align: "center" });
  doc.text("INFERIOR", cx, lowerTop + b * 0.45 + 2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Derecha del\npaciente", cx - a - r - 4, (upperBase + lowerTop) / 2 - 1, { align: "right" });
  doc.text("Izquierda del\npaciente", cx + a + r + 4, (upperBase + lowerTop) / 2 - 1, { align: "left" });
  // Línea media
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(cx, y0 + 3, cx, bottom + 1);
  doc.setLineDashPattern([], 0);

  return bottom - y0;
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
  const showPrices = input.showPrices !== false;
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
  doc.text(showPrices ? "PLAN DE TRATAMIENTO Y PRESUPUESTO" : "PLAN DE TRATAMIENTO", M, 37);

  // ── Datos del paciente ──
  const info: [string, string][] = [
    ["Paciente", input.patientName],
    ["Plan", plan.title],
    ["Fecha de elaboración", longDate(issued)],
  ];
  if (showPrices) info.push(["Vigente hasta", longDate(validUntil)]);
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

  // Uno o varios diagnósticos (uno por línea). Con varios se muestra "Diagnósticos" y una lista.
  const diagnoses = (plan.diagnosis ?? "")
    .split(/\r?\n/)
    .map((d) => d.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
  if (diagnoses.length > 0) {
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(diagnoses.length > 1 ? "Diagnósticos:" : "Diagnóstico:", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    for (const d of diagnoses) {
      const text = diagnoses.length > 1 ? `•  ${d}` : d;
      const lines = doc.splitTextToSize(text, contentW - 42);
      doc.text(lines, M + 42, y);
      y += lines.length * 4.8;
    }
  }
  y += 4;

  // ── Guía de piezas dentales (FDI) ──
  const marked = new Set<string>();
  for (const it of plan.items) {
    if (it.status === "cancelled") continue;
    for (const m of it.tooth_fdi?.match(/[1-4][1-8]/g) ?? []) marked.add(m);
  }
  ensure(145);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Guía de piezas dentales (sistema FDI)", M, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const guide = doc.splitTextToSize(
    "Vista oclusal. El primer número indica el cuadrante y el segundo la pieza (1.1 = incisivo central superior derecho). " +
      "Compare el número de la pieza que se le indique con el diagrama.",
    contentW,
  );
  doc.text(guide, M, y + 1.5);
  y += guide.length * 3.6 + 3;
  const chartH = drawToothChart(doc, M, y, contentW, marked, { ink: INK, muted: MUTED, accent: ACCENT, line: LINE });
  y += chartH + 3;
  if (marked.size > 0) {
    doc.setFillColor(...ACCENT);
    doc.circle(M + 2, y + 1, 1.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Piezas que se tratarán en este plan", M + 5.5, y + 2.1);
    y += 4;
  }
  y += 6;

  // ── Fotos generales del paciente ──
  const overview = input.photos?.overview ?? [];
  if (overview.length > 0) {
    ensure(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text("Estado actual de su boca", M, y);
    y += 4;
    const cols = Math.min(3, overview.length);
    const gap = 4;
    const cellW = (contentW - gap * (cols - 1)) / cols;
    const maxH = 52;
    for (let i = 0; i < overview.length; i += cols) {
      const row = overview.slice(i, i + cols);
      const heights = row.map((p) => Math.min(maxH, (cellW * p.height) / p.width));
      const rowH = Math.max(...heights) + 5;
      ensure(rowH + 4);
      row.forEach((p, j) => {
        const h = heights[j];
        const w = h === maxH ? (maxH * p.width) / p.height : cellW;
        const x = M + j * (cellW + gap) + (cellW - w) / 2;
        doc.addImage(p.dataUrl, "JPEG", x, y, w, h);
        if (p.label) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(p.label, M + j * (cellW + gap) + cellW / 2, y + h + 3.4, { align: "center" });
        }
      });
      y += rowH + 2;
    }
    y += 3;
  }

  // ── Tabla de procedimientos por hemiarcada ──
  const items = plan.items.filter((i) => i.status !== "cancelled");
  const byGroup = new Map<GroupKey, PlanPdfItem[]>();
  for (const it of items) {
    const k = groupForTooth(it.tooth_fdi);
    byGroup.set(k, [...(byGroup.get(k) ?? []), it]);
  }

  const cols = showPrices ? 4 : 3;
  const body: CellDef[][] = [];
  const photoRows = new Map<number, { photo: PdfPhoto; w: number; h: number }>();
  let n = 0;
  let total = 0;
  for (const g of GROUPS) {
    const list = byGroup.get(g.key);
    if (!list || list.length === 0) continue;
    body.push([
      { content: g.label, colSpan: cols, styles: { fillColor: SOFT, fontStyle: "bold", textColor: ACCENT } },
    ]);
    const gp = input.photos?.byGroup?.[g.key];
    if (gp) {
      const h = Math.min(50, (90 * gp.height) / gp.width);
      const w = (h * gp.width) / gp.height;
      photoRows.set(body.length, { photo: gp, w, h });
      body.push([{ content: "", colSpan: cols, styles: { minCellHeight: h + 4 } }]);
    }
    let sub = 0;
    for (const it of list) {
      n += 1;
      const price = it.quoted_price ?? 0;
      sub += price;
      body.push([
        { content: String(n), styles: { halign: "center" } },
        { content: fdiDot(it.tooth_fdi?.trim()) || "—", styles: { halign: "center" } },
        { content: it.procedure_name ?? "Procedimiento" },
        ...(showPrices ? [{ content: it.quoted_price == null ? "—" : money(price), styles: { halign: "right" as const } }] : []),
      ]);
    }
    total += sub;
    if (showPrices) {
      body.push([
        { content: `Subtotal · ${g.label.toLowerCase()}`, colSpan: 3, styles: { halign: "right", fontStyle: "bold", textColor: MUTED } },
        { content: money(sub), styles: { halign: "right", fontStyle: "bold" } },
      ]);
    }
  }

  if (body.length === 0) {
    body.push([{ content: "Este plan aún no tiene procedimientos.", colSpan: cols, styles: { halign: "center", textColor: MUTED } }]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 22 },
    head: [showPrices ? ["#", "Pieza", "Procedimiento", "Costo"] : ["#", "Pieza", "Procedimiento"]],
    body,
    foot: showPrices
      ? [[
          { content: "COSTO TOTAL DEL PLAN", colSpan: 3, styles: { halign: "right" } },
          { content: money(total), styles: { halign: "right" } },
        ]]
      : undefined,
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: INK, textColor: 255, fontStyle: "bold", fontSize: 10 },
    columnStyles: showPrices ? { 0: { cellWidth: 10 }, 1: { cellWidth: 22 }, 3: { cellWidth: 36 } } : { 0: { cellWidth: 10 }, 1: { cellWidth: 28 } },
    didDrawCell: (d) => {
      if (d.section !== "body") return;
      const pr = photoRows.get(d.row.index);
      if (!pr) return;
      doc.addImage(pr.photo.dataUrl, "JPEG", d.cell.x + 2, d.cell.y + 2, pr.w, pr.h);
    },
  });
  y = lastY() + 9;

  if (showPrices) {
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
  }

  // ── Términos y condiciones ──
  const terms: string[] = showPrices ? [
    `Si el paciente paga el plan completo, se le otorga un ${DISCOUNT_FULL_PCT}% de descuento sobre el costo total.`,
    `Si el paciente paga la mitad del plan, se le otorga un ${DISCOUNT_HALF_PCT}% de descuento sobre el costo total.`,
    "Si el paciente paga por tratamiento individual, no se aplica ningún descuento.",
    `Los costos de este plan son vigentes por ${VALIDITY_DAYS} días a partir de la fecha de elaboración o entrega del plan (hasta el ${longDate(validUntil)}).`,
  ] : [];
  if (plan.notes?.trim()) terms.push(plan.notes.trim());

  if (terms.length > 0) {
    ensure(18 + terms.length * 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(showPrices ? "Términos y condiciones" : "Notas", M, y);
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
  }

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
    showPrices
      ? "Declaro que se me ha explicado el plan de tratamiento y sus costos, y que estoy de acuerdo con las condiciones descritas."
      : "Declaro que se me ha explicado el plan de tratamiento y que estoy de acuerdo con el mismo.",
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
