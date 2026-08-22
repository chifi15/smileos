import uuid
from datetime import date
from typing import Optional, Any
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.costos import CostProduct, CostTreatment, CostAppointment, FixedCostsConfig, CostProductLot


# ─── Seed data ────────────────────────────────────────────────────────────────

SEED_PRODUCTS = [
    # Desechables
    {"id": "00000000-0001-0000-0000-000000000001", "name": "Detergente enzimático", "category": "desechable", "unit_price": 4.75, "presentation": "3,800ml", "portion_description": "7.5ml"},
    {"id": "00000000-0001-0000-0000-000000000002", "name": "Agua purificada", "category": "desechable", "unit_price": 1.18, "presentation": "19,000ml", "portion_description": "250ml"},
    {"id": "00000000-0001-0000-0000-000000000003", "name": "Vaso desechable", "category": "desechable", "unit_price": 1.28, "presentation": "100 uds", "portion_description": "1 unidad", "supplier": "SUMIDENTAL"},
    {"id": "00000000-0001-0000-0000-000000000004", "name": "Enjuague bucal", "category": "desechable", "unit_price": 2.78, "presentation": "2,000ml", "portion_description": "5ml"},
    {"id": "00000000-0001-0000-0000-000000000005", "name": "Babero", "category": "desechable", "unit_price": 2.56, "presentation": "50 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000006", "name": "Aromatizante", "category": "desechable", "unit_price": 0.07, "presentation": "400ml", "portion_description": "0.1ml"},
    {"id": "00000000-0001-0000-0000-000000000007", "name": "Toalla de papel", "category": "desechable", "unit_price": 1.5, "presentation": "180 hojas", "portion_description": "1 hoja"},
    {"id": "00000000-0001-0000-0000-000000000008", "name": "Guantes (latex)", "category": "desechable", "unit_price": 2.96, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000009", "name": "Mascarilla Crosstex", "category": "desechable", "unit_price": 20.72, "presentation": "50 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000010", "name": "Mascarilla Euronda", "category": "desechable", "unit_price": 2.0, "presentation": "50 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000011", "name": "Papel adherente", "category": "desechable", "unit_price": 0.56, "presentation": "1,000 uds", "portion_description": "1 unidad", "supplier": "IMPLANTES"},
    {"id": "00000000-0001-0000-0000-000000000012", "name": "Aplicador de madera", "category": "desechable", "unit_price": 0.7, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000013", "name": "Succión de saliva (baja)", "category": "desechable", "unit_price": 2.78, "presentation": "100 uds", "portion_description": "1 unidad", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000014", "name": "Punta de jeringa triple", "category": "desechable", "unit_price": 2.96, "presentation": "250 uds", "portion_description": "1 unidad", "supplier": "INDENT"},
    {"id": "00000000-0001-0000-0000-000000000015", "name": "Rollos de algodón", "category": "desechable", "unit_price": 0.5, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000016", "name": "Gasa 2x2", "category": "desechable", "unit_price": 0.3, "presentation": "200 uds", "portion_description": "1 unidad"},
    # Instrumental / Esterilización
    {"id": "00000000-0001-0000-0000-000000000020", "name": "Bolsa de esterilizar (punta)", "category": "instrumental", "unit_price": 3.15, "presentation": "200 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000021", "name": "Bolsa de esterilizar (básico)", "category": "instrumental", "unit_price": 4.63, "presentation": "200 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000022", "name": "Bolsa de esterilizar (grande)", "category": "instrumental", "unit_price": 6.0, "presentation": "100 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    # Anestesia
    {"id": "00000000-0001-0000-0000-000000000030", "name": "Anestésico tópico", "category": "anestesia", "unit_price": 4.3, "presentation": "43g", "portion_description": "0.5g", "supplier": "INDENT"},
    {"id": "00000000-0001-0000-0000-000000000031", "name": "Aguja corta dental", "category": "anestesia", "unit_price": 4.07, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000032", "name": "Lidocaína con epinefrina (cartucho)", "category": "anestesia", "unit_price": 15.54, "presentation": "50 cartuchos", "portion_description": "1 cartucho (1.8ml)"},
    {"id": "00000000-0001-0000-0000-000000000033", "name": "Articaína con epinefrina (cartucho)", "category": "anestesia", "unit_price": 22.2, "presentation": "50 cartuchos", "portion_description": "1 cartucho (1.8ml)"},
    # Profilaxis
    {"id": "00000000-0001-0000-0000-000000000040", "name": "Piedra pómez", "category": "profilaxis", "unit_price": 0.37, "presentation": "100g", "portion_description": "0.5g"},
    {"id": "00000000-0001-0000-0000-000000000041", "name": "Pasta de zirconio", "category": "profilaxis", "unit_price": 11.73, "presentation": "284g", "portion_description": "3g"},
    {"id": "00000000-0001-0000-0000-000000000042", "name": "Revelador de placa dental", "category": "profilaxis", "unit_price": 1.85, "presentation": "4ml", "portion_description": "0.05ml"},
    {"id": "00000000-0001-0000-0000-000000000043", "name": "Cinta profiláctica", "category": "profilaxis", "unit_price": 18.0, "presentation": "100cm", "portion_description": "4cm", "supplier": "NICADENT"},
    {"id": "00000000-0001-0000-0000-000000000044", "name": "Cepillo de profilaxis", "category": "profilaxis", "unit_price": 15.0, "presentation": "1 unidad", "portion_description": "1 unidad", "supplier": "IMPLANTES"},
    {"id": "00000000-0001-0000-0000-000000000045", "name": "Aeropulidor Polvo Fast", "category": "profilaxis", "unit_price": 14.8, "presentation": "300g", "portion_description": "5g"},
    # Endodoncia
    {"id": "00000000-0001-0000-0000-000000000050", "name": "Cono de papel (1ª serie)", "category": "endodoncia", "unit_price": 0.8, "presentation": "200 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000051", "name": "Cono de papel (2ª serie)", "category": "endodoncia", "unit_price": 1.2, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000052", "name": "Lima Flexofile #15", "category": "endodoncia", "unit_price": 8.5, "presentation": "6 uds", "portion_description": "1 lima"},
    {"id": "00000000-0001-0000-0000-000000000053", "name": "Lima Flexofile #20", "category": "endodoncia", "unit_price": 8.5, "presentation": "6 uds", "portion_description": "1 lima"},
    {"id": "00000000-0001-0000-0000-000000000054", "name": "Lima Flexofile #25", "category": "endodoncia", "unit_price": 8.5, "presentation": "6 uds", "portion_description": "1 lima"},
    {"id": "00000000-0001-0000-0000-000000000055", "name": "Lima Flexofile #30", "category": "endodoncia", "unit_price": 8.5, "presentation": "6 uds", "portion_description": "1 lima"},
    {"id": "00000000-0001-0000-0000-000000000056", "name": "Lima Flexofile #35", "category": "endodoncia", "unit_price": 8.5, "presentation": "6 uds", "portion_description": "1 lima"},
    {"id": "00000000-0001-0000-0000-000000000057", "name": "Stop de hule", "category": "endodoncia", "unit_price": 0.3, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000058", "name": "Hipoclorito de sodio 5.25%", "category": "endodoncia", "unit_price": 0.5, "presentation": "1,000ml", "portion_description": "5ml"},
    {"id": "00000000-0001-0000-0000-000000000059", "name": "EDTA líquido", "category": "endodoncia", "unit_price": 1.2, "presentation": "100ml", "portion_description": "2ml"},
    {"id": "00000000-0001-0000-0000-000000000060", "name": "Hidróxido de calcio (pasta)", "category": "endodoncia", "unit_price": 3.5, "presentation": "50 porciones", "portion_description": "1 porción"},
    {"id": "00000000-0001-0000-0000-000000000061", "name": "Guttapercha (conos principales)", "category": "endodoncia", "unit_price": 6.17, "presentation": "60 uds", "portion_description": "1 cono"},
    {"id": "00000000-0001-0000-0000-000000000062", "name": "Guttapercha (conos accesorios)", "category": "endodoncia", "unit_price": 0.8, "presentation": "100 uds", "portion_description": "1 cono"},
    {"id": "00000000-0001-0000-0000-000000000063", "name": "Sellador endodóntico (Adseal)", "category": "endodoncia", "unit_price": 46.59, "presentation": "15g", "portion_description": "0.3g"},
    {"id": "00000000-0001-0000-0000-000000000064", "name": "Dique de goma (hoja)", "category": "endodoncia", "unit_price": 3.0, "presentation": "36 uds", "portion_description": "1 unidad"},
    # Restauración
    {"id": "00000000-0001-0000-0000-000000000070", "name": "Adhesivo dental", "category": "restauracion", "unit_price": 5.0, "presentation": "5ml", "portion_description": "0.05ml"},
    {"id": "00000000-0001-0000-0000-000000000071", "name": "Composite A2 (jeringa)", "category": "restauracion", "unit_price": 12.0, "presentation": "4g", "portion_description": "0.4g"},
    {"id": "00000000-0001-0000-0000-000000000072", "name": "Composite A3 (jeringa)", "category": "restauracion", "unit_price": 12.0, "presentation": "4g", "portion_description": "0.4g"},
    {"id": "00000000-0001-0000-0000-000000000073", "name": "Ácido grabador (jeringa)", "category": "restauracion", "unit_price": 1.5, "presentation": "5ml", "portion_description": "0.1ml"},
    {"id": "00000000-0001-0000-0000-000000000074", "name": "Pasta de pulido", "category": "restauracion", "unit_price": 2.0, "presentation": "4g", "portion_description": "0.2g"},
    # Fresas
    {"id": "00000000-0001-0000-0000-000000000080", "name": "Fresa redonda pequeña", "category": "instrumental", "unit_price": 11.20, "presentation": "5 usos", "portion_description": "1 uso", "supplier": "GLOBAL"},
    {"id": "00000000-0001-0000-0000-000000000081", "name": "Fresa redonda grande", "category": "instrumental", "unit_price": 16.00, "presentation": "5 usos", "portion_description": "1 uso", "supplier": "GLOBAL"},
    {"id": "00000000-0001-0000-0000-000000000082", "name": "Fresa fisuro", "category": "instrumental", "unit_price": 1.60, "presentation": "5 usos", "portion_description": "1 uso"},
    {"id": "00000000-0001-0000-0000-000000000083", "name": "Fresa cilíndrica", "category": "instrumental", "unit_price": 14.80, "presentation": "5 usos", "portion_description": "1 uso"},
    {"id": "00000000-0001-0000-0000-000000000084", "name": "Fresa Cilíndrica Punta Activa", "category": "instrumental", "unit_price": 29.60, "presentation": "5 usos", "portion_description": "1 uso"},
    {"id": "00000000-0001-0000-0000-000000000085", "name": "Fresa Troncónica Fina", "category": "instrumental", "unit_price": 14.80, "presentation": "5 usos", "portion_description": "1 uso"},
    {"id": "00000000-0001-0000-0000-000000000086", "name": "Fresa Llama", "category": "instrumental", "unit_price": 14.80, "presentation": "5 usos", "portion_description": "1 uso"},
    {"id": "00000000-0001-0000-0000-000000000087", "name": "Fresa Troncónica Ancha", "category": "instrumental", "unit_price": 29.60, "presentation": "5 usos", "portion_description": "1 uso"},
    # Diagnóstico
    {"id": "00000000-0001-0000-0000-000000000090", "name": "Detector de caries", "category": "restauracion", "unit_price": 3.08, "presentation": "6ml", "portion_description": "0.02ml", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000091", "name": "Arenador (abrasivo)", "category": "profilaxis", "unit_price": 3.01, "presentation": "800g", "portion_description": "5g", "supplier": "ONLINE"},
    # Restauración (más materiales)
    {"id": "00000000-0001-0000-0000-000000000092", "name": "Dique de goma (hoja)", "category": "restauracion", "unit_price": 26.72, "presentation": "36 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000093", "name": "Hilo dental encerado Oral B", "category": "restauracion", "unit_price": 1.10, "presentation": "2500cm", "portion_description": "25cm"},
    {"id": "00000000-0001-0000-0000-000000000094", "name": "Barrera gingival", "category": "restauracion", "unit_price": 18.33, "presentation": "2.4g", "portion_description": "0.1g", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000095", "name": "Ionómero fotocurado", "category": "restauracion", "unit_price": 51.80, "presentation": "2.5g", "portion_description": "0.1g", "supplier": "PRODENICSA"},
    {"id": "00000000-0001-0000-0000-000000000096", "name": "Ácido Fosfórico Ultradent", "category": "restauracion", "unit_price": 22.20, "presentation": "30ml", "portion_description": "0.18ml"},
    {"id": "00000000-0001-0000-0000-000000000097", "name": "Adhesivo Universal", "category": "restauracion", "unit_price": 17.92, "presentation": "3ml", "portion_description": "0.04ml", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000098", "name": "Adhesivo 6ta generación", "category": "restauracion", "unit_price": 65.59, "presentation": "11ml", "portion_description": "0.13ml", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000099", "name": "Adhesivo 4ta generación", "category": "restauracion", "unit_price": 45.09, "presentation": "16ml", "portion_description": "0.13ml", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000100", "name": "Microaplicador MagicBrush", "category": "restauracion", "unit_price": 4.63, "presentation": "400 uds", "portion_description": "1 unidad", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000101", "name": "Clorhexidina", "category": "restauracion", "unit_price": 0.47, "presentation": "100ml", "portion_description": "0.2ml", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000102", "name": "Hidróxido de calcio (pasta restauración)", "category": "restauracion", "unit_price": 11.77, "presentation": "11g", "portion_description": "0.1g", "supplier": "Zela"},
    {"id": "00000000-0001-0000-0000-000000000103", "name": "Resina fluida", "category": "restauracion", "unit_price": 63.91, "presentation": "2.2g", "portion_description": "0.1g", "supplier": "INDENT"},
    {"id": "00000000-0001-0000-0000-000000000104", "name": "Resina pasta", "category": "restauracion", "unit_price": 48.68, "presentation": "3.8g", "portion_description": "0.1g", "supplier": "ONLINE"},
    {"id": "00000000-0001-0000-0000-000000000105", "name": "Tinte de resina", "category": "restauracion", "unit_price": 12.95, "presentation": "2g", "portion_description": "0.02g", "supplier": "INDENT"},
    {"id": "00000000-0001-0000-0000-000000000106", "name": "Humectante (Wetting Resin)", "category": "restauracion", "unit_price": 14.80, "presentation": "2.4ml", "portion_description": "0.04ml", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000107", "name": "Teflón TDV", "category": "restauracion", "unit_price": 3.55, "presentation": "500cm", "portion_description": "3cm"},
    {"id": "00000000-0001-0000-0000-000000000108", "name": "Teflón común", "category": "restauracion", "unit_price": 0.25, "presentation": "1500cm", "portion_description": "5cm"},
    {"id": "00000000-0001-0000-0000-000000000109", "name": "Cuñas", "category": "restauracion", "unit_price": 1.44, "presentation": "400 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000110", "name": "Bandas seccionales", "category": "restauracion", "unit_price": 6.66, "presentation": "100 uds", "portion_description": "1 unidad"},
    # Pulido
    {"id": "00000000-0001-0000-0000-000000000111", "name": "Papel de articular", "category": "instrumental", "unit_price": 3.70, "presentation": "100 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000112", "name": "Pasta de pulido Jiffy", "category": "restauracion", "unit_price": 10.36, "presentation": "5g", "portion_description": "0.1g", "supplier": "INDENT"},
    {"id": "00000000-0001-0000-0000-000000000113", "name": "Glicerina", "category": "otros", "unit_price": 0.20, "presentation": "20ml", "portion_description": "0.1ml"},
    {"id": "00000000-0001-0000-0000-000000000114", "name": "Permaseal", "category": "restauracion", "unit_price": 7.71, "presentation": "2.4ml", "portion_description": "0.04ml", "supplier": "ORTHODENTAL"},
    {"id": "00000000-0001-0000-0000-000000000115", "name": "Lubricante instrumental", "category": "instrumental", "unit_price": 1.11, "presentation": "500ml", "portion_description": "0.5ml"},
    # Exodoncia
    {"id": "00000000-0001-0000-0000-000000000116", "name": "Gasa 2×2 (quirúrgica)", "category": "desechable", "unit_price": 0.56, "presentation": "200 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000117", "name": "Gasa 4×4", "category": "desechable", "unit_price": 5.18, "presentation": "50 uds", "portion_description": "1 unidad"},
    # Impresiones
    {"id": "00000000-0001-0000-0000-000000000120", "name": "Encerado diagnóstico", "category": "otros", "unit_price": 1.06, "presentation": "70g", "portion_description": "0.1g"},
    {"id": "00000000-0001-0000-0000-000000000121", "name": "Puntas de liviana (silicona)", "category": "otros", "unit_price": 10.00, "presentation": "50 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000122", "name": "Registro de mordida", "category": "otros", "unit_price": 103.60, "presentation": "50ml", "portion_description": "5ml"},
    {"id": "00000000-0001-0000-0000-000000000123", "name": "Yeso tipo II", "category": "otros", "unit_price": 4.44, "presentation": "5000g", "portion_description": "50g"},
    {"id": "00000000-0001-0000-0000-000000000124", "name": "Yeso para modelos", "category": "otros", "unit_price": 11.10, "presentation": "1000g", "portion_description": "100g"},
    {"id": "00000000-0001-0000-0000-000000000125", "name": "Alginato Zhermack", "category": "otros", "unit_price": 51.80, "presentation": "1000g", "portion_description": "100g"},
    {"id": "00000000-0001-0000-0000-000000000126", "name": "Detergente enzimático (1L)", "category": "desechable", "unit_price": 18.04, "presentation": "1000ml", "portion_description": "7.5ml"},
    {"id": "00000000-0001-0000-0000-000000000127", "name": "Cloruro de aluminio", "category": "restauracion", "unit_price": 30.83, "presentation": "1.2ml", "portion_description": "0.1ml"},
    {"id": "00000000-0001-0000-0000-000000000128", "name": "Hilo retractor 0", "category": "restauracion", "unit_price": 6.82, "presentation": "244cm", "portion_description": "2.5cm"},
    {"id": "00000000-0001-0000-0000-000000000129", "name": "Hilo retractor 000", "category": "restauracion", "unit_price": 6.82, "presentation": "244cm", "portion_description": "2.5cm"},
    {"id": "00000000-0001-0000-0000-000000000130", "name": "Silicona Putty", "category": "otros", "unit_price": 222.00, "presentation": "300g", "portion_description": "30g"},
    {"id": "00000000-0001-0000-0000-000000000131", "name": "Silicona liviana (wash)", "category": "otros", "unit_price": 162.80, "presentation": "50ml", "portion_description": "10ml"},
    {"id": "00000000-0001-0000-0000-000000000132", "name": "Óxido de Aluminio", "category": "otros", "unit_price": 6.94, "presentation": "800g", "portion_description": "10g"},
    {"id": "00000000-0001-0000-0000-000000000133", "name": "Cemento Panavia", "category": "restauracion", "unit_price": 563.33, "presentation": "2.4ml", "portion_description": "0.2ml", "supplier": "IMPROMEDICAL"},
    {"id": "00000000-0001-0000-0000-000000000134", "name": "Tooth Primer", "category": "restauracion", "unit_price": 12.55, "presentation": "4ml", "portion_description": "0.04ml", "supplier": "IMPROMEDICAL"},
    {"id": "00000000-0001-0000-0000-000000000135", "name": "Ceramic Primer", "category": "restauracion", "unit_price": 12.55, "presentation": "4ml", "portion_description": "0.04ml", "supplier": "IMPROMEDICAL"},
    {"id": "00000000-0001-0000-0000-000000000136", "name": "Microaplicador + Punta mezcla", "category": "restauracion", "unit_price": 7.74, "presentation": "50 uds", "portion_description": "1 unidad"},
    {"id": "00000000-0001-0000-0000-000000000137", "name": "Hilo dental superfloss", "category": "restauracion", "unit_price": 5.18, "presentation": "50 uds", "portion_description": "1 unidad"},
]

# Materiales base reutilizables para seed de tratamientos
_BD = [  # base desechables
    {"productId": "00000000-0001-0000-0000-000000000001", "quantity": 1},
    {"productId": "00000000-0001-0000-0000-000000000002", "quantity": 3},
    {"productId": "00000000-0001-0000-0000-000000000003", "quantity": 1},
    {"productId": "00000000-0001-0000-0000-000000000004", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000005", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000006", "quantity": 3},
    {"productId": "00000000-0001-0000-0000-000000000007", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000008", "quantity": 6},
    {"productId": "00000000-0001-0000-0000-000000000010", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000011", "quantity": 11},
    {"productId": "00000000-0001-0000-0000-000000000013", "quantity": 1},
    {"productId": "00000000-0001-0000-0000-000000000014", "quantity": 1},
]
_BE = [  # base esterilización
    {"productId": "00000000-0001-0000-0000-000000000020", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000021", "quantity": 1},
]
_AN = [  # anestesia bloque
    {"productId": "00000000-0001-0000-0000-000000000030", "quantity": 2},
    {"productId": "00000000-0001-0000-0000-000000000031", "quantity": 1},
    {"productId": "00000000-0001-0000-0000-000000000032", "quantity": 2},
]

SEED_TREATMENTS = [
    {
        "name": "Profilaxis Dental",
        "description": "Limpieza profesional con ultrasonido y aeropulidor",
        "professional_fee_per_hour": 192, "total_hours": 1, "fixed_costs": 216, "clinic_margin_pct": 0.15, "suggested_price": 1100,
        "appointments": [
            {"number": 1, "name": "Limpieza y pulido dental", "materials": _BD + _BE + [
                {"productId": "00000000-0001-0000-0000-000000000012", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000030", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000040", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000041", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000042", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000043", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000044", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000045", "quantity": 1},
            ]},
        ],
    },
    {
        "name": "Endodoncia Unirradicular",
        "description": "Tratamiento de conductos en 3 citas — un solo conducto",
        "professional_fee_per_hour": 192, "total_hours": 4, "fixed_costs": 216, "clinic_margin_pct": 0.15, "suggested_price": 3300,
        "appointments": [
            {"number": 1, "name": "Exploración y apertura", "materials": _BD + _BE + _AN + [
                {"productId": "00000000-0001-0000-0000-000000000064", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000052", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000053", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000057", "quantity": 8},
                {"productId": "00000000-0001-0000-0000-000000000058", "quantity": 6},
                {"productId": "00000000-0001-0000-0000-000000000059", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000050", "quantity": 5},
                {"productId": "00000000-0001-0000-0000-000000000051", "quantity": 5},
                {"productId": "00000000-0001-0000-0000-000000000060", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000020", "quantity": 1},
            ]},
            {"number": 2, "name": "Preparación biomecánica", "materials": _BD + _BE + _AN + [
                {"productId": "00000000-0001-0000-0000-000000000064", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000053", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000054", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000055", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000056", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000057", "quantity": 8},
                {"productId": "00000000-0001-0000-0000-000000000058", "quantity": 8},
                {"productId": "00000000-0001-0000-0000-000000000059", "quantity": 4},
                {"productId": "00000000-0001-0000-0000-000000000050", "quantity": 6},
                {"productId": "00000000-0001-0000-0000-000000000051", "quantity": 6},
                {"productId": "00000000-0001-0000-0000-000000000060", "quantity": 1},
            ]},
            {"number": 3, "name": "Obturación y restauración", "materials": _BD + _BE + _AN + [
                {"productId": "00000000-0001-0000-0000-000000000064", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000061", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000062", "quantity": 5},
                {"productId": "00000000-0001-0000-0000-000000000063", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000058", "quantity": 4},
                {"productId": "00000000-0001-0000-0000-000000000050", "quantity": 4},
                {"productId": "00000000-0001-0000-0000-000000000073", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000070", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000071", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000074", "quantity": 1},
            ]},
        ],
    },
    {
        "name": "Consulta",
        "description": "Consulta dental inicial — exploración y diagnóstico",
        "professional_fee_per_hour": 192, "total_hours": 1, "fixed_costs": 216, "clinic_margin_pct": 0.15, "suggested_price": 900,
        "appointments": [
            {"number": 1, "name": "Consulta y diagnóstico", "materials": [
                {"productId": "00000000-0001-0000-0000-000000000001", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000002", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000003", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000004", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000005", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000006", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000007", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000008", "quantity": 6},
                {"productId": "00000000-0001-0000-0000-000000000009", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000010", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000011", "quantity": 11},
                {"productId": "00000000-0001-0000-0000-000000000012", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000030", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000013", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000014", "quantity": 1},
            ]},
        ],
    },
    {
        "name": "Exodoncia Simple",
        "description": "Extracción dental simple",
        "professional_fee_per_hour": 192, "total_hours": 1, "fixed_costs": 216, "clinic_margin_pct": 0.15, "suggested_price": 900,
        "appointments": [
            {"number": 1, "name": "Extracción dental", "materials": [
                {"productId": "00000000-0001-0000-0000-000000000001", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000002", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000003", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000004", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000006", "quantity": 3},
                {"productId": "00000000-0001-0000-0000-000000000007", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000008", "quantity": 6},
                {"productId": "00000000-0001-0000-0000-000000000010", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000011", "quantity": 11},
                {"productId": "00000000-0001-0000-0000-000000000012", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000030", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000014", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000031", "quantity": 1},
                {"productId": "00000000-0001-0000-0000-000000000032", "quantity": 2},
                {"productId": "00000000-0001-0000-0000-000000000116", "quantity": 10},
                {"productId": "00000000-0001-0000-0000-000000000117", "quantity": 1},
            ]},
        ],
    },
]

SEED_FIXED_COSTS = {
    "patients_per_month": 40,
    "items": [
        {"id": str(uuid.uuid4()), "name": "Renta del local", "amount": 3000},
        {"id": str(uuid.uuid4()), "name": "Pago de asistente", "amount": 3000},
        {"id": str(uuid.uuid4()), "name": "Energía eléctrica (luz)", "amount": 1500},
        {"id": str(uuid.uuid4()), "name": "Agua", "amount": 300},
        {"id": str(uuid.uuid4()), "name": "Gasolina", "amount": 500},
        {"id": str(uuid.uuid4()), "name": "Internet / teléfono", "amount": 340},
    ],
}


# ─── Products ─────────────────────────────────────────────────────────────────

async def _seed_products(db: AsyncSession, clinic_id: uuid.UUID) -> list[CostProduct]:
    objs = []
    for i, p in enumerate(SEED_PRODUCTS):
        obj = CostProduct(
            id=uuid.UUID(p["id"]),
            clinic_id=clinic_id,
            name=p["name"],
            category=p["category"],
            unit_price=p["unit_price"],
            presentation=p.get("presentation", ""),
            portion_description=p.get("portion_description", ""),
            supplier=p.get("supplier"),
            sort_order=i,
        )
        db.add(obj)
        objs.append(obj)
    await db.flush()
    return objs


async def get_products(db: AsyncSession, clinic_id: uuid.UUID) -> list[CostProduct]:
    result = await db.execute(
        select(CostProduct)
        .where(CostProduct.clinic_id == clinic_id)
        .order_by(CostProduct.sort_order, CostProduct.created_at)
    )
    products = list(result.scalars().all())
    if not products:
        products = await _seed_products(db, clinic_id)
    return products


async def create_product(db: AsyncSession, clinic_id: uuid.UUID, data: dict) -> CostProduct:
    result = await db.execute(
        select(CostProduct.sort_order)
        .where(CostProduct.clinic_id == clinic_id)
        .order_by(CostProduct.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar() or 0
    obj = CostProduct(clinic_id=clinic_id, sort_order=max_order + 1, **data)
    db.add(obj)
    await db.flush()
    return obj


async def update_product(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID, data: dict) -> Optional[CostProduct]:
    result = await db.execute(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return None
    for k, v in data.items():
        setattr(obj, k, v)
    await db.flush()
    return obj


async def delete_product(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return False
    await db.delete(obj)
    await db.flush()
    return True


async def reorder_products(db: AsyncSession, clinic_id: uuid.UUID, ordered_ids: list[uuid.UUID]) -> None:
    for i, pid in enumerate(ordered_ids):
        await db.execute(
            update(CostProduct)
            .where(CostProduct.id == pid, CostProduct.clinic_id == clinic_id)
            .values(sort_order=i)
        )
    await db.flush()


async def rename_category(db: AsyncSession, clinic_id: uuid.UUID, from_cat: str, to_cat: str) -> int:
    result = await db.execute(
        update(CostProduct)
        .where(CostProduct.clinic_id == clinic_id, CostProduct.category == from_cat)
        .values(category=to_cat)
    )
    await db.flush()
    return result.rowcount


async def delete_category(db: AsyncSession, clinic_id: uuid.UUID, category: str, reassign_to: str) -> int:
    result = await db.execute(
        update(CostProduct)
        .where(CostProduct.clinic_id == clinic_id, CostProduct.category == category)
        .values(category=reassign_to)
    )
    await db.flush()
    return result.rowcount


async def update_product_stock(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID, qty: float, operation: str) -> Optional[CostProduct]:
    result = await db.execute(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return None
    if operation == "add":
        obj.stock_qty = (obj.stock_qty or 0) + qty
    else:
        obj.stock_qty = max(0, qty)
    await db.flush()

    # Auto-track usage on the active lot when stock is deducted
    if operation == "add" and qty < 0:
        lot_result = await db.execute(
            select(CostProductLot)
            .where(CostProductLot.product_id == product_id, CostProductLot.finished_at.is_(None))
            .order_by(CostProductLot.opened_at.desc())
            .limit(1)
        )
        active_lot = lot_result.scalar_one_or_none()
        if active_lot:
            portions = abs(qty) / obj.portion_qty if obj.portion_qty else abs(qty)
            active_lot.used_portions = (active_lot.used_portions or 0) + portions
            await db.flush()

    return obj


async def update_min_stock(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID, min_qty: Optional[float]) -> Optional[CostProduct]:
    result = await db.execute(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return None
    obj.min_stock_qty = min_qty
    await db.flush()
    return obj


# ─── Treatments ───────────────────────────────────────────────────────────────

async def _seed_treatments(db: AsyncSession, clinic_id: uuid.UUID) -> list[CostTreatment]:
    objs = []
    for i, t in enumerate(SEED_TREATMENTS):
        treatment = CostTreatment(
            clinic_id=clinic_id,
            name=t["name"],
            description=t.get("description"),
            professional_fee_per_hour=t["professional_fee_per_hour"],
            total_hours=t["total_hours"],
            fixed_costs=t["fixed_costs"],
            clinic_margin_pct=t["clinic_margin_pct"],
            suggested_price=t.get("suggested_price"),
            sort_order=i,
        )
        db.add(treatment)
        await db.flush()
        for j, apt in enumerate(t["appointments"]):
            db.add(CostAppointment(
                treatment_id=treatment.id,
                number=apt["number"],
                name=apt["name"],
                materials=apt["materials"],
                sort_order=j,
            ))
        await db.flush()
        objs.append(treatment)
    return objs


async def get_treatments(db: AsyncSession, clinic_id: uuid.UUID) -> list[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
        .order_by(CostTreatment.sort_order, CostTreatment.created_at)
    )
    treatments = list(result.scalars().all())
    if not treatments:
        treatments = await _seed_treatments(db, clinic_id)
        result2 = await db.execute(
            select(CostTreatment)
            .where(CostTreatment.clinic_id == clinic_id)
            .options(selectinload(CostTreatment.appointments))
            .order_by(CostTreatment.sort_order, CostTreatment.created_at)
        )
        treatments = list(result2.scalars().all())
    return treatments


async def create_treatment(db: AsyncSession, clinic_id: uuid.UUID, data: dict, appointments: list[dict]) -> CostTreatment:
    result = await db.execute(
        select(CostTreatment.sort_order)
        .where(CostTreatment.clinic_id == clinic_id)
        .order_by(CostTreatment.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar() or 0
    treatment = CostTreatment(clinic_id=clinic_id, sort_order=max_order + 1, **data)
    db.add(treatment)
    await db.flush()
    for j, apt in enumerate(appointments):
        db.add(CostAppointment(
            treatment_id=treatment.id,
            number=apt.get("number", j + 1),
            name=apt.get("name", f"Cita {j + 1}"),
            materials=apt.get("materials", []),
            sort_order=j,
        ))
    await db.flush()
    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment.id)
        .options(selectinload(CostTreatment.appointments))
    )
    return result2.scalar_one()


async def duplicate_treatment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    original = result.scalar_one_or_none()
    if not original:
        return None
    data = {
        "name": f"Copia de {original.name}",
        "description": original.description,
        "professional_fee_per_hour": original.professional_fee_per_hour,
        "total_hours": original.total_hours,
        "fixed_costs": original.fixed_costs,
        "clinic_margin_pct": original.clinic_margin_pct,
        "suggested_price": original.suggested_price,
        "procedure_catalog_id": original.procedure_catalog_id,
    }
    apts = [
        {"number": a.number, "name": a.name, "materials": a.materials}
        for a in sorted(original.appointments, key=lambda a: a.sort_order)
    ]
    return await create_treatment(db, clinic_id, data, apts)


async def update_treatment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, data: dict) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return None
    for k, v in data.items():
        setattr(obj, k, v)
    await db.flush()
    return obj


async def delete_treatment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(CostTreatment).where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return False
    await db.delete(obj)
    await db.flush()
    return True


async def reorder_treatments(db: AsyncSession, clinic_id: uuid.UUID, ordered_ids: list[uuid.UUID]) -> None:
    for i, tid in enumerate(ordered_ids):
        await db.execute(
            update(CostTreatment)
            .where(CostTreatment.id == tid, CostTreatment.clinic_id == clinic_id)
            .values(sort_order=i)
        )
    await db.flush()


async def add_appointment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatment = result.scalar_one_or_none()
    if not treatment:
        return None
    n = len(treatment.appointments) + 1
    db.add(CostAppointment(
        treatment_id=treatment_id,
        number=n,
        name=f"Cita {n}",
        materials=[],
        sort_order=n - 1,
    ))
    await db.flush()
    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id)
        .options(selectinload(CostTreatment.appointments))
    )
    return result2.scalar_one()


async def duplicate_appointment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, apt_id: uuid.UUID) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatment = result.scalar_one_or_none()
    if not treatment:
        return None
    original = next((a for a in treatment.appointments if a.id == apt_id), None)
    if not original:
        return None
    n = len(treatment.appointments) + 1
    db.add(CostAppointment(
        treatment_id=treatment_id,
        number=n,
        name=f"Copia de {original.name}",
        materials=list(original.materials),
        sort_order=n - 1,
    ))
    await db.flush()
    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id)
        .options(selectinload(CostTreatment.appointments))
    )
    return result2.scalar_one()


async def update_appointment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, apt_id: uuid.UUID, data: dict) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostAppointment)
        .join(CostTreatment, CostAppointment.treatment_id == CostTreatment.id)
        .where(CostAppointment.id == apt_id, CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        return None
    for k, v in data.items():
        setattr(apt, k, v)
    await db.flush()
    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id)
        .options(selectinload(CostTreatment.appointments))
    )
    return result2.scalar_one()


async def delete_appointment(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, apt_id: uuid.UUID) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostAppointment)
        .join(CostTreatment, CostAppointment.treatment_id == CostTreatment.id)
        .where(CostAppointment.id == apt_id, CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        return None
    await db.delete(apt)
    await db.flush()
    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatment = result2.scalar_one()
    for i, a in enumerate(sorted(treatment.appointments, key=lambda x: x.sort_order)):
        a.number = i + 1
        a.sort_order = i
    await db.flush()
    return treatment


async def merge_appointments(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, target_id: uuid.UUID, source_id: uuid.UUID) -> Optional[CostTreatment]:
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatment = result.scalar_one_or_none()
    if not treatment:
        return None

    target = next((a for a in treatment.appointments if a.id == target_id), None)
    source = next((a for a in treatment.appointments if a.id == source_id), None)
    if not target or not source:
        return None

    merged: dict[str, float] = {}
    for m in target.materials:
        merged[m["productId"]] = merged.get(m["productId"], 0) + m["quantity"]
    for m in source.materials:
        merged[m["productId"]] = merged.get(m["productId"], 0) + m["quantity"]

    target.materials = [{"productId": pid, "quantity": qty} for pid, qty in merged.items()]
    await db.delete(source)
    await db.flush()

    result2 = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.id == treatment_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatment = result2.scalar_one()
    for i, a in enumerate(sorted(treatment.appointments, key=lambda x: x.sort_order)):
        a.number = i + 1
        a.sort_order = i
    await db.flush()
    return treatment


async def link_procedure(db: AsyncSession, clinic_id: uuid.UUID, treatment_id: uuid.UUID, procedure_catalog_id: Optional[uuid.UUID]) -> Optional[CostTreatment]:
    return await update_treatment(db, clinic_id, treatment_id, {"procedure_catalog_id": procedure_catalog_id})


# ─── Fixed Costs ──────────────────────────────────────────────────────────────

async def get_fixed_costs(db: AsyncSession, clinic_id: uuid.UUID) -> FixedCostsConfig:
    result = await db.execute(
        select(FixedCostsConfig).where(FixedCostsConfig.clinic_id == clinic_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        seed = SEED_FIXED_COSTS
        config = FixedCostsConfig(
            clinic_id=clinic_id,
            patients_per_month=seed["patients_per_month"],
            items=seed["items"],
        )
        db.add(config)
        await db.flush()
    return config


async def update_fixed_costs(db: AsyncSession, clinic_id: uuid.UUID, patients_per_month: int, items: list[dict]) -> tuple[FixedCostsConfig, int]:
    config = await get_fixed_costs(db, clinic_id)
    config.patients_per_month = patients_per_month
    config.items = items
    await db.flush()
    updated = await _sync_operational_costs(db, clinic_id, patients_per_month, items)
    return config, updated


async def _sync_operational_costs(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patients_per_month: int,
    items: list[dict],
) -> int:
    """Recalculate ProcedureCatalog.operational_cost for all treatments linked to a procedure.
    Also updates CostTreatment.fixed_costs to the new per-patient fixed cost.
    Returns the number of procedures updated.
    """
    from app.models.treatment import ProcedureCatalog

    per_patient = sum(float(i.get("amount", 0)) for i in items) / max(patients_per_month, 1)

    # Load all linked treatments with their appointments
    result = await db.execute(
        select(CostTreatment)
        .where(
            CostTreatment.clinic_id == clinic_id,
            CostTreatment.procedure_catalog_id.isnot(None),
        )
        .options(selectinload(CostTreatment.appointments))
    )
    treatments = list(result.scalars().all())
    if not treatments:
        return 0

    # Collect all product IDs referenced in appointment materials
    all_product_ids: set[uuid.UUID] = set()
    for t in treatments:
        for apt in t.appointments:
            for mat in (apt.materials or []):
                if pid := mat.get("productId"):
                    try:
                        all_product_ids.add(uuid.UUID(str(pid)))
                    except ValueError:
                        pass

    product_prices: dict[str, float] = {}
    if all_product_ids:
        prod_result = await db.execute(
            select(CostProduct.id, CostProduct.unit_price)
            .where(CostProduct.clinic_id == clinic_id, CostProduct.id.in_(all_product_ids))
        )
        product_prices = {str(r.id): float(r.unit_price or 0.0) for r in prod_result}

    # Load linked ProcedureCatalog rows
    proc_ids = [t.procedure_catalog_id for t in treatments]
    proc_result = await db.execute(
        select(ProcedureCatalog).where(ProcedureCatalog.id.in_(proc_ids))
    )
    procedures: dict[uuid.UUID, ProcedureCatalog] = {p.id: p for p in proc_result.scalars().all()}

    updated = 0
    for treatment in treatments:
        # Material cost across all appointments
        material_cost = 0.0
        for apt in treatment.appointments:
            for mat in (apt.materials or []):
                pid = mat.get("productId")
                qty = float(mat.get("quantity", 0))
                if pid and qty > 0:
                    material_cost += qty * product_prices.get(str(pid), 0.0)

        # Update treatment fixed_costs to the new per-patient value
        treatment.fixed_costs = round(per_patient, 2)

        # Recalculate operational cost
        prof_fees = float(treatment.professional_fee_per_hour) * float(treatment.total_hours)
        new_op_cost = round(material_cost + prof_fees + per_patient, 2)

        proc = procedures.get(treatment.procedure_catalog_id)
        if proc:
            proc.operational_cost = new_op_cost
            updated += 1

    await db.flush()
    return updated


# ─── Product Lots ─────────────────────────────────────────────────────────────

async def get_lots(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID) -> list[CostProductLot]:
    result = await db.execute(
        select(CostProductLot)
        .where(CostProductLot.product_id == product_id, CostProductLot.clinic_id == clinic_id)
        .order_by(CostProductLot.opened_at.desc())
    )
    return list(result.scalars().all())


async def open_lot(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID, opened_at: date, expected_portions: Optional[float], notes: Optional[str]) -> CostProductLot:
    lot = CostProductLot(
        clinic_id=clinic_id,
        product_id=product_id,
        opened_at=opened_at,
        expected_portions=expected_portions,
        used_portions=0.0,
        notes=notes,
    )
    db.add(lot)
    await db.flush()
    return lot


async def finish_lot(db: AsyncSession, clinic_id: uuid.UUID, lot_id: uuid.UUID, finished_at: date) -> Optional[CostProductLot]:
    result = await db.execute(
        select(CostProductLot)
        .where(CostProductLot.id == lot_id, CostProductLot.clinic_id == clinic_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        return None
    lot.finished_at = finished_at
    await db.flush()
    return lot


async def update_lot(db: AsyncSession, clinic_id: uuid.UUID, lot_id: uuid.UUID, data: dict) -> Optional[CostProductLot]:
    result = await db.execute(
        select(CostProductLot)
        .where(CostProductLot.id == lot_id, CostProductLot.clinic_id == clinic_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        return None
    for k, v in data.items():
        setattr(lot, k, v)
    await db.flush()
    return lot


async def delete_lot(db: AsyncSession, clinic_id: uuid.UUID, lot_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(CostProductLot)
        .where(CostProductLot.id == lot_id, CostProductLot.clinic_id == clinic_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        return False
    await db.delete(lot)
    await db.flush()
    return True


async def get_product_patient_usage(db: AsyncSession, clinic_id: uuid.UUID, product_id: uuid.UUID) -> list[dict]:
    from app.models.finance import FinanceTransaction

    product_id_str = str(product_id)

    # Find all cost treatments for this clinic that use this product
    result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    treatments = list(result.scalars().all())

    # Map procedure_catalog_id → {treatment_name, qty_per_procedure}
    procedure_usage: dict[str, dict] = {}
    for treatment in treatments:
        if not treatment.procedure_catalog_id:
            continue
        total_qty = sum(
            float(mat.get("quantity", 0))
            for apt in treatment.appointments
            for mat in (apt.materials or [])
            if mat.get("productId") == product_id_str
        )
        if total_qty > 0:
            proc_str = str(treatment.procedure_catalog_id)
            if proc_str not in procedure_usage:
                procedure_usage[proc_str] = {"treatment_name": treatment.name, "qty": total_qty}

    if not procedure_usage:
        return []

    proc_ids = [uuid.UUID(pid) for pid in procedure_usage.keys()]

    ft_result = await db.execute(
        select(FinanceTransaction)
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            FinanceTransaction.procedure_id.in_(proc_ids),
            FinanceTransaction.patient_id.isnot(None),
        )
        .options(
            selectinload(FinanceTransaction.patient),
            selectinload(FinanceTransaction.procedure),
        )
        .order_by(FinanceTransaction.transaction_date.desc())
    )
    transactions = list(ft_result.scalars().all())

    usage = []
    for tx in transactions:
        t_info = procedure_usage.get(str(tx.procedure_id))
        if not t_info:
            continue
        proc_qty = tx.procedure_quantity or 1
        usage.append({
            "patient_id": str(tx.patient_id),
            "patient_name": tx.patient.full_name if tx.patient else "—",
            "date": tx.transaction_date.isoformat(),
            "procedure_name": tx.procedure.name if tx.procedure else None,
            "treatment_name": t_info["treatment_name"],
            "qty_per_procedure": t_info["qty"],
            "procedure_quantity": proc_qty,
            "total_quantity": t_info["qty"] * proc_qty,
            "transaction_id": str(tx.id),
        })

    return usage
