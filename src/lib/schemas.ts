import { z } from "zod";

/** Tolerancia al comparar importes, para absorber redondeos a céntimos. */
const TOLERANCIA = 0.02;

const fecha = z.iso.date("Fecha no válida (AAAA-MM-DD)");
const importe = z.number("Debe ser un número");
const moneda = z
  .string()
  .regex(/^[A-Z]{3}$/, "Código ISO de 3 letras (EUR, USD…)");

const parte = z.object({
  nombre: z.string().min(1, "Obligatorio"),
  id_fiscal: z.string().optional(),
  direccion: z.string().optional(),
});

const concepto = z.object({
  descripcion: z.string().min(1, "Obligatorio"),
  cantidad: z.number().optional(),
  precio_unitario: z.number().optional(),
  importe: importe,
});

const impuesto = z.object({
  tipo: z.string().optional(),
  tasa: z.number().optional(),
  importe: importe,
});

/** subtotal + impuestos debe cuadrar con el total. */
function comprobarTotal(
  d: { subtotal?: number; impuestos?: { importe: number }[]; total: number },
  ctx: z.RefinementCtx,
) {
  if (typeof d.subtotal !== "number") return;
  const impuestos = (d.impuestos ?? []).reduce((s, i) => s + i.importe, 0);
  const esperado = d.subtotal + impuestos;
  if (Math.abs(esperado - d.total) > TOLERANCIA) {
    ctx.addIssue({
      code: "custom",
      path: ["total"],
      message: `No cuadra: subtotal + impuestos = ${esperado.toFixed(2)}`,
    });
  }
}

export const facturaSchema = z
  .object({
    numero: z.string().min(1, "Obligatorio"),
    fecha_emision: fecha,
    fecha_vencimiento: fecha.optional(),
    emisor: parte,
    receptor: parte,
    conceptos: z.array(concepto).min(1, "Debe haber al menos un concepto"),
    subtotal: importe.optional(),
    impuestos: z.array(impuesto).optional(),
    total: importe,
    moneda: moneda,
    forma_pago: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    comprobarTotal(d, ctx);
    if (d.fecha_vencimiento && d.fecha_vencimiento < d.fecha_emision) {
      ctx.addIssue({
        code: "custom",
        path: ["fecha_vencimiento"],
        message: "Anterior a la fecha de emisión",
      });
    }
  });

export const reciboSchema = z
  .object({
    numero: z.string().optional(),
    fecha: fecha,
    comercio: parte,
    conceptos: z.array(concepto).min(1, "Debe haber al menos un concepto"),
    subtotal: importe.optional(),
    impuestos: z.array(impuesto).optional(),
    total: importe,
    moneda: moneda,
    metodo_pago: z.string().optional(),
  })
  .superRefine(comprobarTotal);

export const contratoSchema = z
  .object({
    titulo: z.string().min(1, "Obligatorio"),
    tipo_contrato: z.string().optional(),
    fecha_firma: fecha,
    fecha_inicio: fecha.optional(),
    fecha_fin: fecha.optional(),
    partes: z.array(parte).min(2, "Debe haber al menos dos partes"),
    objeto: z.string().min(1, "Obligatorio"),
    importe: importe.optional(),
    moneda: moneda.optional(),
    condiciones_pago: z.string().optional(),
    duracion: z.string().optional(),
    clausulas_clave: z.array(z.string()).optional(),
    jurisdiccion: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fecha_inicio && d.fecha_fin && d.fecha_fin < d.fecha_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["fecha_fin"],
        message: "Anterior a la fecha de inicio",
      });
    }
  });

/** Sin campos obligatorios: no sabemos qué documento es. */
export const otroSchema = z.record(z.string(), z.unknown());

export const datosSchemas = {
  factura: facturaSchema,
  recibo: reciboSchema,
  contrato: contratoSchema,
  otro: otroSchema,
} as const;

export const TIPOS = ["factura", "recibo", "contrato", "otro"] as const;
export type Tipo = (typeof TIPOS)[number];

export const extractionSchema = z.object({
  tipo: z.enum(TIPOS),
  confianza: z.number().min(0).max(1),
  resumen: z.string(),
  /** Transcripción completa: es lo que se convierte en embeddings */
  texto: z.string().default(""),
  datos: z.record(z.string(), z.unknown()),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** Errores indexados por ruta ("datos.total", "datos.conceptos.0.importe"). */
export type Issues = Record<string, string>;

/** Campos que define el esquema de cada tipo, en orden. */
export function camposEsperados(tipo: Tipo): string[] {
  const schema = datosSchemas[tipo];
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  return shape ? Object.keys(shape) : [];
}

/**
 * zod no ejecuta los refinements si el objeto ya tiene errores de tipo, así que
 * la cuadratura de importes se comprueba también por separado.
 */
function issueDeTotales(datos: Record<string, unknown>): string | undefined {
  const { subtotal, total, impuestos } = datos as {
    subtotal?: unknown;
    total?: unknown;
    impuestos?: unknown;
  };
  if (typeof subtotal !== "number" || typeof total !== "number") return;
  const suma = Array.isArray(impuestos)
    ? impuestos.reduce(
        (s: number, i) =>
          s + (typeof (i as { importe?: unknown })?.importe === "number"
            ? (i as { importe: number }).importe
            : 0),
        0,
      )
    : 0;
  const esperado = subtotal + suma;
  if (Math.abs(esperado - total) > TOLERANCIA) {
    return `No cuadra: subtotal + impuestos = ${esperado.toFixed(2)}`;
  }
}

function valorEn(datos: Record<string, unknown>, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (acc, k) =>
      acc === null || acc === undefined
        ? undefined
        : (acc as Record<PropertyKey, unknown>)[k],
    datos,
  );
}

/** Solo necesita el tipo y los datos: el resto de la extracción no se valida. */
export function validarExtraccion(
  extraction: Pick<Extraction, "tipo" | "datos">,
): Issues {
  const issues: Issues = {};
  if (extraction.tipo === "factura" || extraction.tipo === "recibo") {
    const totales = issueDeTotales(extraction.datos);
    if (totales) issues["datos.total"] = totales;
  }

  const schema = datosSchemas[extraction.tipo] ?? otroSchema;
  const result = schema.safeParse(extraction.datos);
  if (result.success) return issues;

  for (const issue of result.error.issues) {
    const clave = ["datos", ...issue.path.map(String)].join(".");
    // Un campo ausente se explica como tal, no con el error de su formato
    const mensaje =
      valorEn(extraction.datos, issue.path) === undefined
        ? "Falta este campo obligatorio"
        : issue.message;
    // El primer error de cada campo es el más específico
    issues[clave] ??= mensaje;
  }
  return issues;
}
