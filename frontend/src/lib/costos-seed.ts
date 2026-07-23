import { Product, Treatment } from "@/types/costos";

export const SEED_PRODUCTS: Product[] = [
  // ── Desechables ────────────────────────────────────────────────────────
  {
    id: "p001",
    name: "Detergente enzimático",
    category: "desechable",
    unitPrice: 4.75,
    presentation: "3,800ml",
    portionDescription: "7.5ml",
    supplier: "",
  },
  {
    id: "p002",
    name: "Agua purificada",
    category: "desechable",
    unitPrice: 1.18,
    presentation: "19,000ml",
    portionDescription: "250ml",
    supplier: "",
  },
  {
    id: "p003",
    name: "Vaso desechable",
    category: "desechable",
    unitPrice: 1.28,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "SUMIDENTAL",
  },
  {
    id: "p004",
    name: "Enjuague bucal",
    category: "desechable",
    unitPrice: 2.78,
    presentation: "2,000ml",
    portionDescription: "5ml",
    supplier: "",
  },
  {
    id: "p005",
    name: "Babero",
    category: "desechable",
    unitPrice: 2.56,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p006",
    name: "Aromatizante",
    category: "desechable",
    unitPrice: 0.07,
    presentation: "400ml",
    portionDescription: "0.1ml",
    supplier: "",
  },
  {
    id: "p007",
    name: "Toalla de papel",
    category: "desechable",
    unitPrice: 1.5,
    presentation: "180 hojas",
    portionDescription: "1 hoja",
    supplier: "",
  },
  {
    id: "p008",
    name: "Guantes (latex)",
    category: "desechable",
    unitPrice: 2.96,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p009",
    name: "Mascarilla Crosstex",
    category: "desechable",
    unitPrice: 20.72,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },
  {
    id: "p010",
    name: "Mascarilla Euronda",
    category: "desechable",
    unitPrice: 2.0,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p011",
    name: "Papel adherente",
    category: "desechable",
    unitPrice: 0.56,
    presentation: "1,000 uds",
    portionDescription: "1 unidad",
    supplier: "IMPLANTES",
  },
  {
    id: "p012",
    name: "Aplicador de madera",
    category: "desechable",
    unitPrice: 0.7,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p013",
    name: "Succión de saliva (baja)",
    category: "desechable",
    unitPrice: 2.78,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "ORTHODENTAL",
  },
  {
    id: "p014",
    name: "Punta de jeringa triple",
    category: "desechable",
    unitPrice: 2.96,
    presentation: "250 uds",
    portionDescription: "1 unidad",
    supplier: "INDENT",
  },
  {
    id: "p015",
    name: "Rollos de algodón",
    category: "desechable",
    unitPrice: 0.5,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p016",
    name: "Gasa 2x2",
    category: "desechable",
    unitPrice: 0.3,
    presentation: "200 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },

  // ── Esterilización / Instrumental ─────────────────────────────────────
  {
    id: "p020",
    name: "Bolsa de esterilizar (punta)",
    category: "instrumental",
    unitPrice: 3.15,
    presentation: "200 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },
  {
    id: "p021",
    name: "Bolsa de esterilizar (básico)",
    category: "instrumental",
    unitPrice: 4.63,
    presentation: "200 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },
  {
    id: "p022",
    name: "Bolsa de esterilizar (grande)",
    category: "instrumental",
    unitPrice: 6.0,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },

  // ── Anestesia ─────────────────────────────────────────────────────────
  {
    id: "p030",
    name: "Anestésico tópico",
    category: "anestesia",
    unitPrice: 4.3,
    presentation: "43g",
    portionDescription: "0.5g",
    supplier: "INDENT",
  },
  {
    id: "p031",
    name: "Aguja corta dental",
    category: "anestesia",
    unitPrice: 4.07,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p032",
    name: "Lidocaína con epinefrina (cartucho)",
    category: "anestesia",
    unitPrice: 15.54,
    presentation: "50 cartuchos",
    portionDescription: "1 cartucho (1.8ml)",
    supplier: "",
  },
  {
    id: "p033",
    name: "Articaína con epinefrina (cartucho)",
    category: "anestesia",
    unitPrice: 22.2,
    presentation: "50 cartuchos",
    portionDescription: "1 cartucho (1.8ml)",
    supplier: "",
  },

  // ── Profilaxis ────────────────────────────────────────────────────────
  {
    id: "p040",
    name: "Piedra pómez",
    category: "profilaxis",
    unitPrice: 0.37,
    presentation: "100g",
    portionDescription: "0.5g",
    supplier: "",
  },
  {
    id: "p041",
    name: "Pasta de zirconio",
    category: "profilaxis",
    unitPrice: 11.73,
    presentation: "284g",
    portionDescription: "3g",
    supplier: "",
  },
  {
    id: "p042",
    name: "Revelador de placa dental",
    category: "profilaxis",
    unitPrice: 1.85,
    presentation: "4ml",
    portionDescription: "0.05ml",
    supplier: "",
  },
  {
    id: "p043",
    name: "Cinta profiláctica",
    category: "profilaxis",
    unitPrice: 18.0,
    presentation: "100cm",
    portionDescription: "4cm",
    supplier: "NICADENT",
  },
  {
    id: "p044",
    name: "Cepillo de profilaxis",
    category: "profilaxis",
    unitPrice: 15.0,
    presentation: "1 unidad",
    portionDescription: "1 unidad",
    supplier: "IMPLANTES",
  },
  {
    id: "p045",
    name: "Aeropulidor Polvo Fast",
    category: "profilaxis",
    unitPrice: 14.8,
    presentation: "300g",
    portionDescription: "5g",
    supplier: "",
  },

  // ── Endodoncia ────────────────────────────────────────────────────────
  {
    id: "p050",
    name: "Cono de papel (1ª serie)",
    category: "endodoncia",
    unitPrice: 0.8,
    presentation: "200 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p051",
    name: "Cono de papel (2ª serie)",
    category: "endodoncia",
    unitPrice: 1.2,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p052",
    name: "Lima Flexofile #15",
    category: "endodoncia",
    unitPrice: 8.5,
    presentation: "6 uds",
    portionDescription: "1 lima",
    supplier: "",
  },
  {
    id: "p053",
    name: "Lima Flexofile #20",
    category: "endodoncia",
    unitPrice: 8.5,
    presentation: "6 uds",
    portionDescription: "1 lima",
    supplier: "",
  },
  {
    id: "p054",
    name: "Lima Flexofile #25",
    category: "endodoncia",
    unitPrice: 8.5,
    presentation: "6 uds",
    portionDescription: "1 lima",
    supplier: "",
  },
  {
    id: "p055",
    name: "Lima Flexofile #30",
    category: "endodoncia",
    unitPrice: 8.5,
    presentation: "6 uds",
    portionDescription: "1 lima",
    supplier: "",
  },
  {
    id: "p056",
    name: "Lima Flexofile #35",
    category: "endodoncia",
    unitPrice: 8.5,
    presentation: "6 uds",
    portionDescription: "1 lima",
    supplier: "",
  },
  {
    id: "p057",
    name: "Stop de hule",
    category: "endodoncia",
    unitPrice: 0.3,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p058",
    name: "Hipoclorito de sodio 5.25%",
    category: "endodoncia",
    unitPrice: 0.5,
    presentation: "1,000ml",
    portionDescription: "5ml",
    supplier: "",
  },
  {
    id: "p059",
    name: "EDTA líquido",
    category: "endodoncia",
    unitPrice: 1.2,
    presentation: "100ml",
    portionDescription: "2ml",
    supplier: "",
  },
  {
    id: "p060",
    name: "Hidróxido de calcio (pasta)",
    category: "endodoncia",
    unitPrice: 3.5,
    presentation: "50 porciones",
    portionDescription: "1 porción",
    supplier: "",
  },
  {
    id: "p061",
    name: "Guttapercha (conos principales)",
    category: "endodoncia",
    unitPrice: 6.17,
    presentation: "60 uds",
    portionDescription: "1 cono",
    supplier: "",
  },
  {
    id: "p062",
    name: "Guttapercha (conos accesorios)",
    category: "endodoncia",
    unitPrice: 0.8,
    presentation: "100 uds",
    portionDescription: "1 cono",
    supplier: "",
  },
  {
    id: "p063",
    name: "Sellador endodóntico (Adseal)",
    category: "endodoncia",
    unitPrice: 46.59,
    presentation: "15g",
    portionDescription: "0.3g",
    supplier: "",
  },
  {
    id: "p064",
    name: "Dique de goma (hoja)",
    category: "endodoncia",
    unitPrice: 3.0,
    presentation: "36 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },

  // ── Restauración ──────────────────────────────────────────────────────
  {
    id: "p070",
    name: "Adhesivo dental",
    category: "restauracion",
    unitPrice: 5.0,
    presentation: "5ml",
    portionDescription: "0.05ml",
    supplier: "",
  },
  {
    id: "p071",
    name: "Composite A2 (jeringa)",
    category: "restauracion",
    unitPrice: 12.0,
    presentation: "4g",
    portionDescription: "0.4g",
    supplier: "",
  },
  {
    id: "p072",
    name: "Composite A3 (jeringa)",
    category: "restauracion",
    unitPrice: 12.0,
    presentation: "4g",
    portionDescription: "0.4g",
    supplier: "",
  },
  {
    id: "p073",
    name: "Ácido grabador (jeringa)",
    category: "restauracion",
    unitPrice: 1.5,
    presentation: "5ml",
    portionDescription: "0.1ml",
    supplier: "",
  },
  {
    id: "p074",
    name: "Pasta de pulido",
    category: "restauracion",
    unitPrice: 2.0,
    presentation: "4g",
    portionDescription: "0.2g",
    supplier: "",
  },
];

// Shared base materials used in every appointment
type MP = { productId: string; quantity: number };

const BASE_DESECHABLES: MP[] = [
  { productId: "p001", quantity: 1 },  // Detergente enzimático
  { productId: "p002", quantity: 3 },  // Agua purificada
  { productId: "p003", quantity: 1 },  // Vaso
  { productId: "p004", quantity: 2 },  // Enjuague
  { productId: "p005", quantity: 2 },  // Babero
  { productId: "p006", quantity: 3 },  // Aromatizante
  { productId: "p007", quantity: 2 },  // Toalla de papel
  { productId: "p008", quantity: 6 },  // Guantes (3 cambios de par)
  { productId: "p010", quantity: 2 },  // Mascarilla Euronda
  { productId: "p011", quantity: 11 }, // Papel adherente
  { productId: "p013", quantity: 1 },  // Succión baja
  { productId: "p014", quantity: 1 },  // Punta jeringa triple
];

const BASE_ESTERILIZACION: MP[] = [
  { productId: "p020", quantity: 2 }, // Bolsa punta
  { productId: "p021", quantity: 1 }, // Bolsa básico
];

const ANESTESIA_BLOQUE: MP[] = [
  { productId: "p030", quantity: 2 }, // Anestésico tópico
  { productId: "p031", quantity: 1 }, // Aguja corta
  { productId: "p032", quantity: 2 }, // Lidocaína
];

export const SEED_TREATMENTS: Treatment[] = [
  // ── PROFILAXIS ─────────────────────────────────────────────────────────
  {
    id: "t001",
    name: "Profilaxis Dental",
    description: "Limpieza profesional con ultrasonido y aeropulidor",
    appointments: [
      {
        id: "t001-c1",
        number: 1,
        name: "Limpieza y pulido dental",
        materials: [
          ...BASE_DESECHABLES,
          ...BASE_ESTERILIZACION,
          { productId: "p012", quantity: 1 },  // Aplicador de madera
          { productId: "p030", quantity: 2 },  // Anestésico tópico
          { productId: "p040", quantity: 1 },  // Piedra pómez
          { productId: "p041", quantity: 1 },  // Pasta de zirconio
          { productId: "p042", quantity: 2 },  // Revelador de placa
          { productId: "p043", quantity: 1 },  // Cinta profiláctica
          { productId: "p044", quantity: 1 },  // Cepillo profilaxis
          { productId: "p045", quantity: 1 },  // Aeropulidor Fast
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 1,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 1100,
  },

  // ── ENDODONCIA UNIRRADICULAR ────────────────────────────────────────────
  {
    id: "t002",
    name: "Endodoncia Unirradicular",
    description: "Tratamiento de conductos en 3 citas — un solo conducto",
    appointments: [
      {
        id: "t002-c1",
        number: 1,
        name: "Exploración y apertura",
        materials: [
          ...BASE_DESECHABLES,
          ...BASE_ESTERILIZACION,
          ...ANESTESIA_BLOQUE,
          { productId: "p064", quantity: 1 },  // Dique de goma
          { productId: "p052", quantity: 2 },  // Lima #15
          { productId: "p053", quantity: 2 },  // Lima #20
          { productId: "p057", quantity: 8 },  // Stops de hule
          { productId: "p058", quantity: 6 },  // Hipoclorito (30ml)
          { productId: "p059", quantity: 3 },  // EDTA (6ml)
          { productId: "p050", quantity: 5 },  // Conos papel 1ª
          { productId: "p051", quantity: 5 },  // Conos papel 2ª
          { productId: "p060", quantity: 1 },  // Hidróxido de calcio
          { productId: "p020", quantity: 1 },  // Bolsa extra
        ],
      },
      {
        id: "t002-c2",
        number: 2,
        name: "Preparación biomecánica",
        materials: [
          ...BASE_DESECHABLES,
          ...BASE_ESTERILIZACION,
          ...ANESTESIA_BLOQUE,
          { productId: "p064", quantity: 1 },  // Dique de goma
          { productId: "p053", quantity: 2 },  // Lima #20
          { productId: "p054", quantity: 2 },  // Lima #25
          { productId: "p055", quantity: 2 },  // Lima #30
          { productId: "p056", quantity: 1 },  // Lima #35
          { productId: "p057", quantity: 8 },  // Stops de hule
          { productId: "p058", quantity: 8 },  // Hipoclorito (40ml)
          { productId: "p059", quantity: 4 },  // EDTA (8ml)
          { productId: "p050", quantity: 6 },  // Conos papel 1ª
          { productId: "p051", quantity: 6 },  // Conos papel 2ª
          { productId: "p060", quantity: 1 },  // Hidróxido de calcio
        ],
      },
      {
        id: "t002-c3",
        number: 3,
        name: "Obturación y restauración",
        materials: [
          ...BASE_DESECHABLES,
          ...BASE_ESTERILIZACION,
          ...ANESTESIA_BLOQUE,
          { productId: "p064", quantity: 1 },  // Dique de goma
          { productId: "p061", quantity: 3 },  // Guttapercha principales
          { productId: "p062", quantity: 5 },  // Guttapercha accesorios
          { productId: "p063", quantity: 1 },  // Sellador Adseal
          { productId: "p058", quantity: 4 },  // Hipoclorito irrigación final
          { productId: "p050", quantity: 4 },  // Conos papel verificación
          { productId: "p073", quantity: 2 },  // Ácido grabador
          { productId: "p070", quantity: 2 },  // Adhesivo
          { productId: "p071", quantity: 3 },  // Composite A2
          { productId: "p074", quantity: 1 },  // Pasta de pulido
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 4,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 3300,
  },
];
