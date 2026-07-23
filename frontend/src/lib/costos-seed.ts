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

  // ── Fresas ────────────────────────────────────────────────────────────────
  {
    id: "p080",
    name: "Fresa redonda pequeña",
    category: "instrumental",
    unitPrice: 11.20,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "GLOBAL",
  },
  {
    id: "p081",
    name: "Fresa redonda grande",
    category: "instrumental",
    unitPrice: 16.00,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "GLOBAL",
  },
  {
    id: "p082",
    name: "Fresa fisuro",
    category: "instrumental",
    unitPrice: 1.60,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },
  {
    id: "p083",
    name: "Fresa cilíndrica",
    category: "instrumental",
    unitPrice: 14.80,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },
  {
    id: "p084",
    name: "Fresa Cilíndrica Punta Activa",
    category: "instrumental",
    unitPrice: 29.60,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },
  {
    id: "p085",
    name: "Fresa Troncónica Fina",
    category: "instrumental",
    unitPrice: 14.80,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },
  {
    id: "p086",
    name: "Fresa Llama",
    category: "instrumental",
    unitPrice: 14.80,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },
  {
    id: "p087",
    name: "Fresa Troncónica Ancha",
    category: "instrumental",
    unitPrice: 29.60,
    presentation: "5 usos",
    portionDescription: "1 uso",
    supplier: "",
  },

  // ── Preparación / Diagnóstico ─────────────────────────────────────────────
  {
    id: "p090",
    name: "Detector de caries",
    category: "restauracion",
    unitPrice: 3.08,
    presentation: "6ml",
    portionDescription: "0.02ml",
    supplier: "ONLINE",
  },
  {
    id: "p091",
    name: "Arenador (abrasivo)",
    category: "profilaxis",
    unitPrice: 3.01,
    presentation: "800g",
    portionDescription: "5g",
    supplier: "ONLINE",
  },

  // ── Restauración (nuevos materiales) ──────────────────────────────────────
  {
    id: "p092",
    name: "Dique de goma (hoja)",
    category: "restauracion",
    unitPrice: 26.72,
    presentation: "36 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },
  {
    id: "p093",
    name: "Hilo dental encerado Oral B",
    category: "restauracion",
    unitPrice: 1.10,
    presentation: "2500cm",
    portionDescription: "25cm",
    supplier: "",
  },
  {
    id: "p094",
    name: "Barrera gingival",
    category: "restauracion",
    unitPrice: 18.33,
    presentation: "2.4g",
    portionDescription: "0.1g",
    supplier: "ORTHODENTAL",
  },
  {
    id: "p095",
    name: "Ionómero fotocurado",
    category: "restauracion",
    unitPrice: 51.80,
    presentation: "2.5g",
    portionDescription: "0.1g",
    supplier: "PRODENICSA",
  },
  {
    id: "p096",
    name: "Ácido Fosfórico Ultradent",
    category: "restauracion",
    unitPrice: 22.20,
    presentation: "30ml",
    portionDescription: "0.18ml",
    supplier: "",
  },
  {
    id: "p097",
    name: "Adhesivo Universal",
    category: "restauracion",
    unitPrice: 17.92,
    presentation: "3ml",
    portionDescription: "0.04ml",
    supplier: "ORTHODENTAL",
  },
  {
    id: "p098",
    name: "Adhesivo 6ta generación",
    category: "restauracion",
    unitPrice: 65.59,
    presentation: "11ml",
    portionDescription: "0.13ml",
    supplier: "ONLINE",
  },
  {
    id: "p099",
    name: "Adhesivo 4ta generación",
    category: "restauracion",
    unitPrice: 45.09,
    presentation: "16ml",
    portionDescription: "0.13ml",
    supplier: "ONLINE",
  },
  {
    id: "p100",
    name: "Microaplicador MagicBrush",
    category: "restauracion",
    unitPrice: 4.63,
    presentation: "400 uds",
    portionDescription: "1 unidad",
    supplier: "ONLINE",
  },
  {
    id: "p101",
    name: "Clorhexidina",
    category: "restauracion",
    unitPrice: 0.47,
    presentation: "100ml",
    portionDescription: "0.2ml",
    supplier: "ORTHODENTAL",
  },
  {
    id: "p102",
    name: "Hidróxido de calcio (pasta restauración)",
    category: "restauracion",
    unitPrice: 11.77,
    presentation: "11g",
    portionDescription: "0.1g",
    supplier: "Zela",
  },
  {
    id: "p103",
    name: "Resina fluida",
    category: "restauracion",
    unitPrice: 63.91,
    presentation: "2.2g",
    portionDescription: "0.1g",
    supplier: "INDENT",
  },
  {
    id: "p104",
    name: "Resina pasta",
    category: "restauracion",
    unitPrice: 48.68,
    presentation: "3.8g",
    portionDescription: "0.1g",
    supplier: "ONLINE",
  },
  {
    id: "p105",
    name: "Tinte de resina",
    category: "restauracion",
    unitPrice: 12.95,
    presentation: "2g",
    portionDescription: "0.02g",
    supplier: "INDENT",
  },
  {
    id: "p106",
    name: "Humectante (Wetting Resin)",
    category: "restauracion",
    unitPrice: 14.80,
    presentation: "2.4ml",
    portionDescription: "0.04ml",
    supplier: "ORTHODENTAL",
  },
  // Resina Clase II — matrices y teflón
  {
    id: "p107",
    name: "Teflón TDV",
    category: "restauracion",
    unitPrice: 3.55,
    presentation: "500cm",
    portionDescription: "3cm",
    supplier: "",
  },
  {
    id: "p108",
    name: "Teflón común",
    category: "restauracion",
    unitPrice: 0.25,
    presentation: "1500cm",
    portionDescription: "5cm",
    supplier: "",
  },
  {
    id: "p109",
    name: "Cuñas",
    category: "restauracion",
    unitPrice: 1.44,
    presentation: "400 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p110",
    name: "Bandas seccionales",
    category: "restauracion",
    unitPrice: 6.66,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },

  // ── Pulido ────────────────────────────────────────────────────────────────
  {
    id: "p111",
    name: "Papel de articular",
    category: "instrumental",
    unitPrice: 3.70,
    presentation: "100 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p112",
    name: "Pasta de pulido Jiffy",
    category: "restauracion",
    unitPrice: 10.36,
    presentation: "5g",
    portionDescription: "0.1g",
    supplier: "INDENT",
  },
  {
    id: "p113",
    name: "Glicerina",
    category: "otros",
    unitPrice: 0.20,
    presentation: "20ml",
    portionDescription: "0.1ml",
    supplier: "",
  },
  {
    id: "p114",
    name: "Permaseal",
    category: "restauracion",
    unitPrice: 7.71,
    presentation: "2.4ml",
    portionDescription: "0.04ml",
    supplier: "ORTHODENTAL",
  },
  {
    id: "p115",
    name: "Lubricante instrumental",
    category: "instrumental",
    unitPrice: 1.11,
    presentation: "500ml",
    portionDescription: "0.5ml",
    supplier: "",
  },

  // ── Exodoncia ─────────────────────────────────────────────────────────────
  {
    id: "p116",
    name: "Gasa 2×2 (quirúrgica)",
    category: "desechable",
    unitPrice: 0.56,
    presentation: "200 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p117",
    name: "Gasa 4×4",
    category: "desechable",
    unitPrice: 5.18,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },

  // ── Impresiones / Incrusta ────────────────────────────────────────────────
  {
    id: "p120",
    name: "Encerado diagnóstico",
    category: "otros",
    unitPrice: 1.06,
    presentation: "70g",
    portionDescription: "0.1g",
    supplier: "",
  },
  {
    id: "p121",
    name: "Puntas de liviana (silicona)",
    category: "otros",
    unitPrice: 10.00,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p122",
    name: "Registro de mordida",
    category: "otros",
    unitPrice: 103.60,
    presentation: "50ml",
    portionDescription: "5ml",
    supplier: "",
  },
  {
    id: "p123",
    name: "Yeso tipo II",
    category: "otros",
    unitPrice: 4.44,
    presentation: "5000g",
    portionDescription: "50g",
    supplier: "",
  },
  {
    id: "p124",
    name: "Yeso para modelos",
    category: "otros",
    unitPrice: 11.10,
    presentation: "1000g",
    portionDescription: "100g",
    supplier: "",
  },
  {
    id: "p125",
    name: "Alginato Zhermack",
    category: "otros",
    unitPrice: 51.80,
    presentation: "1000g",
    portionDescription: "100g",
    supplier: "",
  },
  {
    id: "p126",
    name: "Detergente enzimático (1L)",
    category: "desechable",
    unitPrice: 18.04,
    presentation: "1000ml",
    portionDescription: "7.5ml",
    supplier: "",
  },
  {
    id: "p127",
    name: "Cloruro de aluminio",
    category: "restauracion",
    unitPrice: 30.83,
    presentation: "1.2ml",
    portionDescription: "0.1ml",
    supplier: "",
  },
  {
    id: "p128",
    name: "Hilo retractor 0",
    category: "restauracion",
    unitPrice: 6.82,
    presentation: "244cm",
    portionDescription: "2.5cm",
    supplier: "",
  },
  {
    id: "p129",
    name: "Hilo retractor 000",
    category: "restauracion",
    unitPrice: 6.82,
    presentation: "244cm",
    portionDescription: "2.5cm",
    supplier: "",
  },
  {
    id: "p130",
    name: "Silicona Putty",
    category: "otros",
    unitPrice: 222.00,
    presentation: "300g",
    portionDescription: "30g",
    supplier: "",
  },
  {
    id: "p131",
    name: "Silicona liviana (wash)",
    category: "otros",
    unitPrice: 162.80,
    presentation: "50ml",
    portionDescription: "10ml",
    supplier: "",
  },
  {
    id: "p132",
    name: "Óxido de Aluminio",
    category: "otros",
    unitPrice: 6.94,
    presentation: "800g",
    portionDescription: "10g",
    supplier: "",
  },
  {
    id: "p133",
    name: "Cemento Panavia",
    category: "restauracion",
    unitPrice: 563.33,
    presentation: "2.4ml",
    portionDescription: "0.2ml",
    supplier: "IMPROMEDICAL",
  },
  {
    id: "p134",
    name: "Tooth Primer",
    category: "restauracion",
    unitPrice: 12.55,
    presentation: "4ml",
    portionDescription: "0.04ml",
    supplier: "IMPROMEDICAL",
  },
  {
    id: "p135",
    name: "Ceramic Primer",
    category: "restauracion",
    unitPrice: 12.55,
    presentation: "4ml",
    portionDescription: "0.04ml",
    supplier: "IMPROMEDICAL",
  },
  {
    id: "p136",
    name: "Microaplicador + Punta mezcla",
    category: "restauracion",
    unitPrice: 7.74,
    presentation: "50 uds",
    portionDescription: "1 unidad",
    supplier: "",
  },
  {
    id: "p137",
    name: "Hilo dental superfloss",
    category: "restauracion",
    unitPrice: 5.18,
    presentation: "50 uds",
    portionDescription: "1 unidad",
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

  // ── CONSULTA ───────────────────────────────────────────────────────────────
  {
    id: "t003",
    name: "Consulta",
    description: "Consulta dental inicial — exploración y diagnóstico",
    appointments: [
      {
        id: "t003-c1",
        number: 1,
        name: "Consulta y diagnóstico",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p009", quantity: 1 },   // Mascarilla Crosstex
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 1,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 900,
  },

  // ── SELLANTES F.F. ─────────────────────────────────────────────────────────
  {
    id: "t004",
    name: "Sellantes F.F.",
    description: "Sellantes de fosas y fisuras — prevención de caries",
    appointments: [
      {
        id: "t004-c1",
        number: 1,
        name: "Aplicación de sellantes",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p009", quantity: 1 },   // Mascarilla Crosstex
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p031", quantity: 1 },   // Aguja
          { productId: "p032", quantity: 1 },   // Lidocaína
          { productId: "p080", quantity: 1 },   // Fresa redonda pequeña
          { productId: "p082", quantity: 1 },   // Fresa fisuro
          { productId: "p090", quantity: 3 },   // Detector de caries
          { productId: "p091", quantity: 1 },   // Arenador
          { productId: "p092", quantity: 1 },   // Dique de goma
          { productId: "p093", quantity: 1 },   // Hilo dental encerado
          { productId: "p094", quantity: 1 },   // Barrera gingival
          { productId: "p096", quantity: 1 },   // Ácido Fosfórico Ultradent
          { productId: "p099", quantity: 3 },   // Adhesivo 4ta generación
          { productId: "p100", quantity: 3 },   // Microaplicador MagicBrush
          { productId: "p103", quantity: 1 },   // Resina fluida
          { productId: "p111", quantity: 2 },   // Papel de articular
          { productId: "p112", quantity: 1 },   // Pasta de pulido Jiffy
          { productId: "p113", quantity: 1 },   // Glicerina
          { productId: "p114", quantity: 1 },   // Permaseal
          { productId: "p115", quantity: 1 },   // Lubricante instrumental
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 1,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 1400,
  },

  // ── RESINA CLASE I ─────────────────────────────────────────────────────────
  {
    id: "t005",
    name: "Resina Clase I",
    description: "Restauración de resina compuesta — cavidad oclusal (Clase I)",
    appointments: [
      {
        id: "t005-c1",
        number: 1,
        name: "Preparación y restauración",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p010", quantity: 1 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p031", quantity: 1 },   // Aguja
          { productId: "p032", quantity: 1 },   // Lidocaína
          { productId: "p080", quantity: 1 },   // Fresa redonda pequeña
          { productId: "p081", quantity: 1 },   // Fresa redonda grande
          { productId: "p090", quantity: 1 },   // Detector de caries
          { productId: "p092", quantity: 1 },   // Dique de goma
          { productId: "p093", quantity: 1 },   // Hilo dental encerado
          { productId: "p094", quantity: 1 },   // Barrera gingival
          { productId: "p096", quantity: 1 },   // Ácido Fosfórico Ultradent
          { productId: "p099", quantity: 3 },   // Adhesivo 4ta generación
          { productId: "p100", quantity: 3 },   // Microaplicador MagicBrush
          { productId: "p102", quantity: 1 },   // Hidróxido de calcio pasta
          { productId: "p103", quantity: 1 },   // Resina fluida
          { productId: "p104", quantity: 2 },   // Resina pasta
          { productId: "p105", quantity: 1 },   // Tinte de resina
          { productId: "p106", quantity: 1 },   // Humectante
          { productId: "p111", quantity: 1 },   // Papel de articular
          { productId: "p112", quantity: 1 },   // Pasta de pulido Jiffy
          { productId: "p113", quantity: 1 },   // Glicerina
          { productId: "p114", quantity: 1 },   // Permaseal
          { productId: "p115", quantity: 1 },   // Lubricante instrumental
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 2,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 1600,
  },

  // ── RESINA CLASE II ────────────────────────────────────────────────────────
  {
    id: "t006",
    name: "Resina Clase II",
    description: "Restauración de resina compuesta — cavidad proximal (Clase II)",
    appointments: [
      {
        id: "t006-c1",
        number: 1,
        name: "Preparación y restauración proximal",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p009", quantity: 1 },   // Mascarilla Crosstex
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p031", quantity: 1 },   // Aguja
          { productId: "p032", quantity: 1 },   // Lidocaína
          { productId: "p080", quantity: 1 },   // Fresa redonda pequeña
          { productId: "p081", quantity: 1 },   // Fresa redonda grande
          { productId: "p083", quantity: 1 },   // Fresa cilíndrica
          { productId: "p090", quantity: 3 },   // Detector de caries
          { productId: "p091", quantity: 1 },   // Arenador
          { productId: "p092", quantity: 1 },   // Dique de goma
          { productId: "p093", quantity: 1 },   // Hilo dental encerado
          { productId: "p094", quantity: 1 },   // Barrera gingival
          { productId: "p096", quantity: 1 },   // Ácido Fosfórico Ultradent
          { productId: "p099", quantity: 3 },   // Adhesivo 4ta generación
          { productId: "p100", quantity: 3 },   // Microaplicador MagicBrush
          { productId: "p103", quantity: 1 },   // Resina fluida
          { productId: "p104", quantity: 3 },   // Resina pasta (3 porciones)
          { productId: "p105", quantity: 1 },   // Tinte de resina
          { productId: "p106", quantity: 1 },   // Humectante
          { productId: "p107", quantity: 2 },   // Teflón TDV
          { productId: "p108", quantity: 3 },   // Teflón común
          { productId: "p109", quantity: 2 },   // Cuñas
          { productId: "p110", quantity: 2 },   // Bandas seccionales
          { productId: "p111", quantity: 2 },   // Papel de articular
          { productId: "p112", quantity: 1 },   // Pasta de pulido Jiffy
          { productId: "p113", quantity: 1 },   // Glicerina
          { productId: "p114", quantity: 1 },   // Permaseal
          { productId: "p115", quantity: 1 },   // Lubricante instrumental
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 2,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 1700,
  },

  // ── EXODONCIA SIMPLE ───────────────────────────────────────────────────────
  {
    id: "t007",
    name: "Exodoncia Simple",
    description: "Extracción dental simple",
    appointments: [
      {
        id: "t007-c1",
        number: 1,
        name: "Extracción dental",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p031", quantity: 1 },   // Aguja
          { productId: "p032", quantity: 2 },   // Lidocaína (2 cartuchos)
          { productId: "p116", quantity: 10 },  // Gasa 2×2
          { productId: "p117", quantity: 1 },   // Gasa 4×4
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 1,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 900,
  },

  // ── INCRUSTA RESINA ────────────────────────────────────────────────────────
  {
    id: "t008",
    name: "Incrusta Resina",
    description: "Restauración indirecta de resina — 5 citas (impresión, preparación, impresión def., cementación, pulido)",
    appointments: [
      {
        id: "t008-c1",
        number: 1,
        name: "Cita 1 — Impresión primaria",
        materials: [
          { productId: "p001", quantity: 1 },   // Detergente enzimático
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 1 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 4 },   // Guantes
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p120", quantity: 1 },   // Encerado diagnóstico
          { productId: "p121", quantity: 1 },   // Puntas de liviana
          { productId: "p122", quantity: 1 },   // Registro de mordida
          { productId: "p123", quantity: 1 },   // Yeso tipo II
          { productId: "p124", quantity: 2 },   // Yeso para modelos
          { productId: "p125", quantity: 2 },   // Alginato Zhermack
        ],
      },
      {
        id: "t008-c2",
        number: 2,
        name: "Cita 2 — Preparación",
        materials: [
          { productId: "p126", quantity: 1 },   // Detergente 1L
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p031", quantity: 1 },   // Aguja
          { productId: "p032", quantity: 1 },   // Lidocaína
          { productId: "p080", quantity: 1 },   // Fresa redonda pequeña
          { productId: "p081", quantity: 1 },   // Fresa redonda grande
          { productId: "p084", quantity: 1 },   // Fresa Cilíndrica Punta Activa
          { productId: "p085", quantity: 1 },   // Fresa Troncónica Fina
          { productId: "p086", quantity: 1 },   // Fresa Llama
          { productId: "p087", quantity: 1 },   // Fresa Troncónica Ancha
          { productId: "p090", quantity: 3 },   // Detector de caries
          { productId: "p091", quantity: 1 },   // Arenador
          { productId: "p092", quantity: 1 },   // Dique de goma
          { productId: "p093", quantity: 1 },   // Hilo dental encerado
          { productId: "p094", quantity: 1 },   // Barrera gingival
          { productId: "p096", quantity: 1 },   // Ácido Fosfórico Ultradent
          { productId: "p099", quantity: 2 },   // Adhesivo 4ta generación
          { productId: "p100", quantity: 3 },   // Microaplicador MagicBrush
          { productId: "p102", quantity: 1 },   // Hidróxido de calcio pasta
          { productId: "p103", quantity: 1 },   // Resina fluida
          { productId: "p104", quantity: 1 },   // Resina pasta
          { productId: "p105", quantity: 1 },   // Tinte de resina
          { productId: "p106", quantity: 1 },   // Humectante
        ],
      },
      {
        id: "t008-c3",
        number: 3,
        name: "Cita 3 — Impresión definitiva + Lab",
        materials: [
          { productId: "p126", quantity: 1 },   // Detergente 1L
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 4 },   // Guantes
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 1 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p127", quantity: 1 },   // Cloruro de aluminio
          { productId: "p128", quantity: 1 },   // Hilo retractor 0
          { productId: "p129", quantity: 1 },   // Hilo retractor 000
          { productId: "p130", quantity: 1 },   // Silicona Putty
          { productId: "p121", quantity: 1 },   // Puntas de liviana
          { productId: "p131", quantity: 1 },   // Silicona liviana
          { productId: "p122", quantity: 1 },   // Registro de mordida
          { productId: "p124", quantity: 2 },   // Yeso para modelos
          { productId: "p103", quantity: 1 },   // Resina fluida
          { productId: "p104", quantity: 4 },   // Resina pasta (4 porciones)
          { productId: "p105", quantity: 1 },   // Tinte de resina
          { productId: "p106", quantity: 1 },   // Humectante
        ],
      },
      {
        id: "t008-c4",
        number: 4,
        name: "Cita 4 — Cementación",
        materials: [
          { productId: "p126", quantity: 1 },   // Detergente 1L
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 4 },   // Guantes
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p092", quantity: 1 },   // Dique de goma
          { productId: "p093", quantity: 1 },   // Hilo dental encerado
          { productId: "p132", quantity: 1 },   // Óxido de Aluminio
          { productId: "p107", quantity: 2 },   // Teflón TDV (Isotape)
          { productId: "p096", quantity: 1 },   // Ácido Fosfórico Ultradent
          { productId: "p133", quantity: 1 },   // Cemento Panavia
          { productId: "p134", quantity: 1 },   // Tooth Primer
          { productId: "p135", quantity: 1 },   // Ceramic Primer
          { productId: "p136", quantity: 4 },   // Microaplicador + Punta mezcla
          { productId: "p137", quantity: 1 },   // Hilo dental superfloss
        ],
      },
      {
        id: "t008-c5",
        number: 5,
        name: "Cita 5 — Pulido final",
        materials: [
          { productId: "p126", quantity: 1 },   // Detergente 1L
          { productId: "p002", quantity: 3 },   // Agua purificada
          { productId: "p003", quantity: 1 },   // Vaso
          { productId: "p004", quantity: 2 },   // Enjuague
          { productId: "p005", quantity: 2 },   // Babero
          { productId: "p006", quantity: 3 },   // Aromatizante
          { productId: "p007", quantity: 2 },   // Toalla
          { productId: "p008", quantity: 6 },   // Guantes
          { productId: "p009", quantity: 1 },   // Mascarilla Crosstex
          { productId: "p010", quantity: 2 },   // Mascarilla Euronda
          { productId: "p011", quantity: 11 },  // Papel adherente
          { productId: "p012", quantity: 1 },   // Aplicador
          { productId: "p030", quantity: 2 },   // Anestésico tópico
          { productId: "p013", quantity: 1 },   // Succión
          { productId: "p014", quantity: 1 },   // Punta jeringa triple
          { productId: "p111", quantity: 2 },   // Papel de articular
          { productId: "p112", quantity: 1 },   // Pasta de pulido Jiffy
          { productId: "p113", quantity: 1 },   // Glicerina
          { productId: "p114", quantity: 1 },   // Permaseal
          { productId: "p115", quantity: 1 },   // Lubricante instrumental
        ],
      },
    ],
    professionalFeePerHour: 192,
    totalHours: 5,
    fixedCosts: 216,
    clinicMarginPct: 0.15,
    suggestedPrice: 4700,
  },
];
