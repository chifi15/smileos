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
  /** Fotos (recortadas) para mostrar bajo el encabezado de cada hemiarcada. */
  byGroup: Partial<Record<string, PdfPhoto[]>>;
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
  /** Mostrar la guía de piezas FDI (por defecto sí). */
  showChart?: boolean;
  /** 'plan' respeta el orden de los procedimientos tal como vienen; 'fdi' los ordena por pieza (por defecto). */
  itemOrder?: "plan" | "fdi";
}

// ─── Reglas comerciales ──────────────────────────────────────────────────────
// Descuento por pago único según el monto del plan (tramos, de mayor a menor mínimo)
export const FULL_PAYMENT_TIERS = [
  { min: 25000, pct: 15 },
  { min: 10000, pct: 12 },
  { min: 0, pct: 8 },
];
export const fullPaymentPct = (total: number) => (FULL_PAYMENT_TIERS.find((t) => total >= t.min) ?? FULL_PAYMENT_TIERS[FULL_PAYMENT_TIERS.length - 1]).pct;
export const DISCOUNT_HALF_PCT = 5;
export const MIN_ITEMS_DISCOUNT = 2; // mínimo de procedimientos para ofrecer descuento (1 solo = tratamiento individual)
export const VALIDITY_DAYS = 15;

import { GROUPS, groupForTooth, parseTeeth, type GroupKey } from "@/lib/plan-groups";
export { GROUPS, groupForTooth };
export type { GroupKey };

// ─── Notación FDI con punto (1.1, 2.6…) ──────────────────────────────────────
/** "26, 16" → "1.6, 2.6" (ordenadas por cuadrante y luego de incisivo a molar) */
export const fdiDot = (v: string | null | undefined) => {
  const t = [...parseTeeth(v)].sort();
  return t.length > 0 ? t.map((x) => `${x[0]}.${x[1]}`).join(", ") : (v ?? "");
};

// Ancho relativo de cada diente (1 = central … 8 = tercer molar) para repartirlos en la arcada
const TOOTH_W: Record<number, number> = { 1: 8, 2: 6.5, 3: 7.5, 4: 7, 5: 7, 6: 10, 7: 9.5, 8: 9 };
// Dientes temporales (1 = central … 5 = segundo molar)
const DECID_W: Record<number, number> = { 1: 8, 2: 6.5, 3: 7.5, 4: 9, 5: 10 };

type RGB = [number, number, number];
// Colores bien diferenciables (todos legibles con texto blanco)
const PROC_COLORS: RGB[] = [
  [37, 99, 235], [220, 38, 38], [22, 163, 74], [234, 88, 12], [147, 51, 234],
  [13, 148, 136], [219, 39, 119], [161, 98, 7], [71, 85, 105], [8, 145, 178],
];

// Caja estándar por orientación (4:3 horizontal, 3:4 vertical) para que las fotos de la misma
// orientación siempre se vean del mismo tamaño en el PDF.
const isPortrait = (p: PdfPhoto) => p.height > p.width;
const boxW = (p: PdfPhoto, h: number, maxW: number) => (isPortrait(p) ? Math.min(maxW, (h * 3) / 4) : Math.min(maxW, (h * 4) / 3));

/** Dibuja la foto llenando la caja (recorte centrado); si la proporción difiere mucho, la ajusta sin recortar. */
function drawPhotoBox(doc: jsPDF, p: PdfPhoto, x: number, y: number, w: number, h: number) {
  const r = p.width / p.height;
  const br = w / h;
  if (Math.abs(r / br - 1) > 0.35) {
    const k = Math.min(w / p.width, h / p.height);
    const iw = p.width * k;
    const ih = p.height * k;
    doc.addImage(p.dataUrl, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    return;
  }
  const iw = r > br ? h * r : w;
  const ih = r > br ? h : w / r;
  doc.saveGraphicsState();
  doc.rect(x, y, w, h, null);
  doc.clip();
  doc.discardPath();
  doc.addImage(p.dataUrl, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  doc.restoreGraphicsState();
}

/** Dibuja la guía de piezas FDI (vista oclusal) resaltando las piezas del plan. */
function drawToothChart(
  doc: jsPDF,
  x0: number,
  y0: number,
  width: number,
  marked: Map<string, RGB[]>,
  showDeciduous: boolean,
  colors: { ink: [number, number, number]; muted: [number, number, number]; accent: [number, number, number]; line: [number, number, number] },
): number {
  const a = Math.min(40, width / 2 - 12); // semieje horizontal (arcada angosta)
  const b = 46; // profundidad de la arcada (alargada)
  const cx = x0 + width / 2;
  const r = 4.6; // radio máx. de los círculos

  const arch = (nums: number[], baseY: number, up: boolean, a: number, b: number, rMax: number, small = false) => {
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
    const widths = nums.map((n) => (small ? DECID_W : TOOTH_W)[n % 10]);
    const totalW = widths.reduce((s, w) => s + w, 0);
    let acc = 0;
    nums.forEach((n, i) => {
      const mid = ((acc + widths[i] / 2) / totalW) * len;
      acc += widths[i];
      const p = pts.find((q) => q.len >= mid) ?? pts[N];
      const rad = Math.min(rMax, ((widths[i] / totalW) * len * 0.92) / 2);
      const procColors = marked.get(String(n));
      const isMarked = !!procColors;
      const main = procColors?.[0] ?? colors.accent;
      doc.setLineWidth(isMarked ? 0.5 : 0.25);
      doc.setDrawColor(...(isMarked ? main : colors.line));
      doc.setFillColor(...(isMarked ? main : ([255, 255, 255] as [number, number, number])));
      doc.circle(p.x, p.y, rad, "FD");
      // Más de un tratamiento en la misma pieza: puntos de color adicionales
      (procColors ?? []).slice(1).forEach((c, k) => {
        doc.setFillColor(...c);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.circle(p.x + rad * 0.78 - k * 2.6, p.y - rad * 0.78, 1.25, "FD");
      });
      doc.setFont("helvetica", isMarked ? "bold" : "normal");
      doc.setFontSize(small ? (isMarked ? 5.6 : 5.3) : isMarked ? 6.6 : 6.2);
      doc.setTextColor(...(isMarked ? ([255, 255, 255] as [number, number, number]) : colors.ink));
      doc.text(`${Math.floor(n / 10)}.${n % 10}`, p.x, p.y + 0.9, { align: "center" });
    });
  };

  const upperTop = y0 + 6;
  const upperBase = upperTop + b + r; // línea base (extremos) de la arcada superior
  arch([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], upperBase, true, a, b, r);
  if (showDeciduous) arch([55, 54, 53, 52, 51, 61, 62, 63, 64, 65], upperBase, true, a - 12, b - 13, 3.7, true);
  const lowerTop = upperBase + r + 9;
  arch([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38], lowerTop, false, a, b, r);
  if (showDeciduous) arch([85, 84, 83, 82, 81, 71, 72, 73, 74, 75], lowerTop, false, a - 12, b - 13, 3.7, true);
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
  // Cada tipo de procedimiento tiene su color; la leyenda indica qué piezas lleva cada uno.
  const procKey = (name: string | null) => (name ?? "Procedimiento").trim().toLowerCase();
  const legendMap = new Map<string, { name: string; color: RGB; teeth: Set<string> }>();
  const marked = new Map<string, RGB[]>();
  for (const it of plan.items) {
    if (it.status === "cancelled") continue;
    // Permanentes 11–48, temporales 51–85
    const teeth = parseTeeth(it.tooth_fdi).filter((t) => (+t[0] <= 4 ? true : +t[1] <= 5));
    if (teeth.length === 0) continue;
    const k = procKey(it.procedure_name);
    if (!legendMap.has(k)) {
      legendMap.set(k, {
        name: it.procedure_name?.trim() || "Procedimiento",
        color: PROC_COLORS[legendMap.size % PROC_COLORS.length],
        teeth: new Set(),
      });
    }
    const entry = legendMap.get(k)!;
    for (const t of teeth) {
      entry.teeth.add(t);
      const list = marked.get(t) ?? [];
      if (!list.includes(entry.color)) marked.set(t, [...list, entry.color]);
    }
  }
  const hasDeciduous = [...marked.keys()].some((t) => +t[0] >= 5);
  const legend = [...legendMap.values()];
  const legendLines = legend.map((l) => {
    const teeth = [...l.teeth].sort().map((t) => `${t[0]}.${t[1]}`).join(", ");
    return doc.splitTextToSize(`${l.name}: ${teeth}`, contentW - 8) as string[];
  });
  const legendH = legendLines.reduce((sum, ls) => sum + ls.length * 4 + 1.5, 0);

  if (input.showChart !== false) {
    ensure(138 + legendH);
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
        "Compare el número de la pieza que se le indique con el diagrama. Cada color corresponde a un tratamiento." +
        (hasDeciduous ? " El arco interior (5.1 a 8.5) son los dientes temporales." : ""),
      contentW,
    );
    doc.text(guide, M, y + 1.5);
    y += guide.length * 3.6 + 3;
    const chartH = drawToothChart(doc, M, y, contentW, marked, hasDeciduous, { ink: INK, muted: MUTED, accent: ACCENT, line: LINE });
    y += chartH + 4;
    legend.forEach((l, i) => {
      doc.setFillColor(...l.color);
      doc.circle(M + 2, y + 1.2, 1.7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(legendLines[i], M + 6.5, y + 2.2);
      y += legendLines[i].length * 4 + 1.5;
    });
    y += 6;
  }

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
    const H = Math.min(52, (cellW * 3) / 4); // misma altura para toda la fila
    for (let i = 0; i < overview.length; i += cols) {
      const row = overview.slice(i, i + cols);
      const rowH = H + 5;
      ensure(rowH + 4);
      row.forEach((p, j) => {
        const w = boxW(p, H, cellW);
        const x = M + j * (cellW + gap) + (cellW - w) / 2;
        drawPhotoBox(doc, p, x, y, w, H);
        if (p.label) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(p.label, M + j * (cellW + gap) + cellW / 2, y + H + 3.4, { align: "center" });
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

  // Opciones alternativas: procedimientos cuyo nombre empieza con «Opción 1)», «Opción 2)»…  El paciente elige UNA,
  // así que no se suman entre sí: cada opción se cotiza como base del plan + esa opción.
  const optionNumOf = (name?: string | null) => {
    const m = /^\s*Opci[oó]n\s*(\d+)\s*[).:\-]/i.exec(name ?? "");
    return m ? Number(m[1]) : null;
  };
  const distinctOptions = new Set(items.map((i) => optionNumOf(i.procedure_name)).filter((x): x is number => x !== null));
  const useOptions = distinctOptions.size >= 2;
  const optTotals = new Map<number, number>();
  const optCounts = new Map<number, number>();
  let baseCount = 0;

  const cols = showPrices ? 4 : 3;
  const body: CellDef[][] = [];
  const photoRows = new Map<number, { rows: { photo: PdfPhoto; x: number; y: number; w: number }[]; h: number }>();
  let n = 0;
  let total = 0;
  for (const g of GROUPS) {
    const list = byGroup.get(g.key);
    if (!list || list.length === 0) continue;
    body.push([
      { content: g.label, colSpan: cols, styles: { fillColor: SOFT, fontStyle: "bold", textColor: ACCENT } },
    ]);
    const gps = input.photos?.byGroup?.[g.key] ?? [];
    if (gps.length > 0) {
      // Misma altura para todas; las del mismo tipo (horizontal/vertical) quedan del mismo tamaño.
      const h = gps.length <= 2 ? 54 : 40;
      const availW = contentW - 6;
      const gapP = 4;
      const placed: { photo: PdfPhoto; x: number; y: number; w: number }[] = [];
      let lineIdx = 0;
      let line: { photo: PdfPhoto; w: number }[] = [];
      const flush = () => {
        const tw = line.reduce((t, q) => t + q.w, 0) + gapP * (line.length - 1);
        let x = (availW - tw) / 2;
        for (const q of line) {
          placed.push({ photo: q.photo, x, y: lineIdx * (h + gapP), w: q.w });
          x += q.w + gapP;
        }
        line = [];
        lineIdx += 1;
      };
      for (const ph of gps) {
        const w = boxW(ph, h, availW);
        const used = line.reduce((t, q) => t + q.w + gapP, 0);
        if (line.length > 0 && used + w > availW) flush();
        line.push({ photo: ph, w });
      }
      if (line.length > 0) flush();
      photoRows.set(body.length, { rows: placed, h });
      body.push([{ content: "", colSpan: cols, styles: { minCellHeight: lineIdx * (h + gapP) + 2 } }]);
    }
    // Orden FDI: cuadrante 1→4 y, dentro de cada uno, de la pieza más cercana a la línea media (1) a la más distal (8).
    // Sort estable: ítems de la misma pieza conservan su orden original.
    const toothKey = (it: PlanPdfItem) => {
      const ts = parseTeeth(it.tooth_fdi);
      return ts.length ? Math.min(...ts.map((t) => +t)) : Number.MAX_SAFE_INTEGER; // cuadrante y luego pieza (1.1 … 1.8, 2.1 …)
    };
    if (input.itemOrder !== "plan") list.sort((a, b) => toothKey(a) - toothKey(b));
    let sub = 0;
    for (const it of list) {
      n += 1;
      const price = it.quoted_price ?? 0;
      const on = useOptions ? optionNumOf(it.procedure_name) : null;
      if (on !== null) {
        optTotals.set(on, (optTotals.get(on) ?? 0) + price);
        optCounts.set(on, (optCounts.get(on) ?? 0) + 1);
      } else {
        sub += price;
        baseCount += 1;
      }
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
        { content: `Subtotal · ${g.label.toLowerCase()}${useOptions && list.some((q) => optionNumOf(q.procedure_name) !== null) ? " (sin opciones)" : ""}`, colSpan: 3, styles: { halign: "right", fontStyle: "bold", textColor: MUTED } },
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
    // Filas completas: si la fila de fotos no cabe, pasa entera a la página siguiente (no se corta sobre el pie).
    rowPageBreak: "avoid",
    head: [showPrices ? ["#", "Pieza", "Procedimiento", "Costo"] : ["#", "Pieza", "Procedimiento"]],
    body,
    foot: showPrices
      ? useOptions
        ? [
            [
              { content: "COSTO BASE DEL PLAN (sin las opciones)", colSpan: 3, styles: { halign: "right" } },
              { content: money(total), styles: { halign: "right" } },
            ],
            ...[...optTotals.keys()].sort((a, b) => a - b).map((k) => [
              { content: `TOTAL ELIGIENDO LA OPCIÓN ${k}`, colSpan: 3, styles: { halign: "right" as const } },
              { content: money(total + (optTotals.get(k) ?? 0)), styles: { halign: "right" as const } },
            ]),
          ]
        : [[
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
      for (const q of pr.rows) drawPhotoBox(doc, q.photo, d.cell.x + 3 + q.x, d.cell.y + 2 + q.y, q.w, pr.h);
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

    const scenarios = useOptions
      ? [...optTotals.keys()].sort((x, z) => x - z).map((k) => ({ title: `Si elige la Opción ${k}`, tot: total + (optTotals.get(k) ?? 0), cnt: baseCount + (optCounts.get(k) ?? 0) }))
      : [{ title: "", tot: total, cnt: n }];
    for (const sc of scenarios) {
      const fullPct = fullPaymentPct(sc.tot);
      const full = sc.tot * (1 - fullPct / 100);
      const twoPays = sc.tot * (1 - DISCOUNT_HALF_PCT / 100); // plan completo pagado en 2 partes
      const planDiscounts = sc.cnt >= MIN_ITEMS_DISCOUNT; // con un solo procedimiento no hay descuentos: es un tratamiento individual
      if (sc.title) {
        ensure(40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...ACCENT);
        doc.text(`${sc.title} · total ${money(sc.tot)}`, M, y + 3);
        y += 5;
      }
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, bottom: 22 },
        head: [["Forma de pago", "Descuento", "Total a pagar", "Ahorro"]],
        body: [
          ...(planDiscounts
            ? [
                ["Plan completo en un solo pago", `${fullPct}%`, money(full), money(sc.tot - full)],
                [`Plan completo en 2 pagos (2 × ${money(twoPays / 2)}): una mitad y luego la otra`, `${DISCOUNT_HALF_PCT}%`, money(twoPays), money(sc.tot - twoPays)],
              ]
            : []),
          ["Pago por tratamiento individual (sin pagar el plan completo)", "Sin descuento", money(sc.tot), money(0)],
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
      y = lastY() + (sc === scenarios[scenarios.length - 1] ? 0 : 6);
    }
    y = lastY() + 9;
  }

  // ── Términos y condiciones ──
  const planDiscountsT = (useOptions ? baseCount + Math.min(...optCounts.values()) : n) >= MIN_ITEMS_DISCOUNT;
  const terms: string[] = showPrices ? [
    ...(planDiscountsT ? [
      `Pago único: si el paciente paga el plan completo en un solo pago, antes de iniciar el tratamiento, se le otorga ${useOptions ? "el descuento que corresponde al total de la opción elegida" : `un ${fullPaymentPct(total)}% de descuento sobre el costo total`}. El descuento según el monto del plan es: ${[...FULL_PAYMENT_TIERS].reverse().map((t, i, arr) => (i === arr.length - 1 ? `${t.pct}% desde ${money(t.min)}` : i === 0 ? `${t.pct}% si el plan es menor a ${money(arr[i + 1].min)}` : `${t.pct}% desde ${money(t.min)} hasta ${money(arr[i + 1].min - 1)}`)).join("; ")}.`,
      `Pago en 2 pagos: si el paciente paga el plan completo en 2 pagos, se le otorga un ${DISCOUNT_HALF_PCT}% de descuento sobre el costo total del plan. La primera mitad se paga antes de iniciar el tratamiento y la segunda mitad al completarse la mitad del plan.`,
      "Si el segundo pago no se realiza al completarse la mitad del plan, el paciente pierde el descuento en todo el plan: deberá pagar el total a precio normal, restando lo que ya pagó.",
    ] : []),
    "Si el paciente paga por tratamiento individual, sin pagar el plan completo, no se aplica ningún descuento.",
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
