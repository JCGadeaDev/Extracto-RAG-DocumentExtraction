import type { Extraction } from "@/lib/schemas";

/** Factura correcta: 11.20 + 2.35 = 13.55 */
export const facturaValida: Extraction = {
  tipo: "factura",
  confianza: 0.98,
  resumen: "Factura de Papeleria Lopez S.L.",
  texto: "FACTURA N. F-2026-0142\nFecha: 15/09/2026\nTotal: 13,55 EUR",
  datos: {
    numero: "F-2026-0142",
    fecha_emision: "2026-09-15",
    emisor: { nombre: "Papeleria Lopez S.L.", id_fiscal: "B12345678" },
    receptor: { nombre: "Juan Perez", id_fiscal: "12345678Z" },
    conceptos: [
      { descripcion: "Cuaderno A4", cantidad: 2, precio_unitario: 3.5, importe: 7 },
      { descripcion: "Boligrafo pack 10", cantidad: 1, precio_unitario: 4.2, importe: 4.2 },
    ],
    subtotal: 11.2,
    impuestos: [{ tipo: "IVA", tasa: 21, importe: 2.35 }],
    total: 13.55,
    moneda: "EUR",
    forma_pago: "Tarjeta",
  },
};

export const contratoValido: Extraction = {
  tipo: "contrato",
  confianza: 0.9,
  resumen: "Contrato de arrendamiento",
  texto: "CONTRATO DE ARRENDAMIENTO DE LOCAL\nRenta: 1.800 EUR al mes",
  datos: {
    titulo: "CONTRATO DE ARRENDAMIENTO DE LOCAL",
    fecha_firma: "2026-03-01",
    fecha_inicio: "2026-04-01",
    fecha_fin: "2031-03-31",
    objeto: "arrendamiento del local en Calle Mayor 10",
    partes: [
      { nombre: "Inmobiliaria Sol S.A.", id_fiscal: "A87654321" },
      { nombre: "Cafe Luna S.L.", id_fiscal: "B11223344" },
    ],
  },
};

export const reciboValido: Extraction = {
  tipo: "recibo",
  confianza: 0.8,
  resumen: "Recibo de supermercado",
  texto: "SUPER SOL\nLeche 2,40\nTOTAL 2,50 EUR",
  datos: {
    fecha: "2026-01-09",
    comercio: { nombre: "Super Sol" },
    conceptos: [{ descripcion: "Leche", cantidad: 2, importe: 2.4 }],
    subtotal: 2.4,
    impuestos: [{ tipo: "IVA", tasa: 4, importe: 0.1 }],
    total: 2.5,
    moneda: "EUR",
  },
};

/** Copia profunda con cambios, para no tocar los fixtures compartidos. */
export function conDatos(
  base: Extraction,
  cambios: Record<string, unknown>,
): Extraction {
  const copia = structuredClone(base);
  return { ...copia, datos: { ...copia.datos, ...cambios } };
}

export function sinCampo(base: Extraction, campo: string): Extraction {
  const copia = structuredClone(base);
  delete copia.datos[campo];
  return copia;
}
