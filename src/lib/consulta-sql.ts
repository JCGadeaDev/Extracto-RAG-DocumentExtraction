import { z } from "zod";
import { poolLectura } from "@/lib/db";
import { completar, leerJson, type MensajeModelo } from "@/lib/openrouter";

// Filas que se devuelven como máximo de una consulta generada
const MAX_FILAS = 200;
const TIEMPO_MAXIMO = "5s";

/**
 * Lo que el modelo sabe de la base de datos. Debe coincidir con db/init.sql y
 * con los permisos de `extracto_lector`.
 */
export const ESQUEMA = `documents(id, filename, doc_type 'factura'|'recibo'|'contrato'|'otro', created_at, confirmed_at)
facturas(document_id → documents.id, numero, fecha_emision date, fecha_vencimiento date,
  emisor_nombre, emisor_id_fiscal, emisor_direccion, receptor_nombre, receptor_id_fiscal,
  receptor_direccion, subtotal numeric, total numeric, moneda char(3), forma_pago)
recibos(document_id → documents.id, numero, fecha date, comercio_nombre, comercio_id_fiscal,
  comercio_direccion, subtotal numeric, total numeric, moneda char(3), metodo_pago)
contratos(document_id → documents.id, titulo, tipo_contrato, fecha_firma date, fecha_inicio date,
  fecha_fin date, objeto, importe numeric, moneda char(3), condiciones_pago, duracion, jurisdiccion)
conceptos(document_id → documents.id, posicion, descripcion, cantidad numeric,
  precio_unitario numeric, importe numeric)   -- líneas de facturas y recibos
impuestos(document_id → documents.id, posicion, tipo, tasa numeric, importe numeric)
partes(document_id → documents.id, posicion, nombre, rol, id_fiscal, direccion)   -- de contratos
clausulas(document_id → documents.id, posicion, texto)   -- de contratos`;

function sistemaPlan(hoy: string) {
  return `Decides cómo responder preguntas sobre los documentos del usuario (facturas, recibos y contratos).

Modos:
- "sql": cálculos y datos estructurados. Totales, sumas, medias, conteos, máximos y mínimos,
  rankings, comparaciones, filtros por fechas, importes, emisor o comercio, y listados.
  Ej.: "¿cuánto he gastado este año?", "¿cuántas facturas tengo?", "¿cuál es el recibo más caro?",
  "facturas que vencen este mes", "gasto por proveedor".
- "semantica": preguntas sobre el contenido o el texto de los documentos.
  Ej.: "¿qué dice la cláusula de rescisión?", "¿qué compré en la papelería?", "¿quién firma el contrato?".

Si el modo es "sql", escribe una única consulta de PostgreSQL:
- Solo SELECT (o WITH … SELECT), sin punto y coma, sin comentarios.
- Usa solo estas tablas y columnas:
${ESQUEMA}
- Devuelve exactamente lo que se pregunta: un total o una media es una sola fila (por moneda),
  sin desglosar por documento salvo que lo pidan.
- Al sumar o comparar importes agrupa por moneda: no mezcles monedas.
- Pon nombres descriptivos en español a las columnas calculadas (AS total_gastado).
- Para buscar por nombre o texto usa ILIKE con comodines.
- Limita los listados a 50 filas.
- Hoy es ${hoy}; usa CURRENT_DATE para fechas relativas.
Añade "sql_documentos": otra consulta SELECT, con los mismos filtros, que devuelva una sola
columna document_id con los documentos distintos que intervienen en el resultado.

Responde SOLO con JSON:
{"modo": "sql", "sql": "…", "sql_documentos": "…"}  o  {"modo": "semantica"}`;
}

const Plan = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("semantica") }),
  z.object({
    modo: z.literal("sql"),
    sql: z.string().min(1),
    sql_documentos: z.string().nullish(),
  }),
]);
export type Plan = z.infer<typeof Plan>;

/**
 * Pregunta al modelo si la pregunta necesita SQL y, si es así, qué consulta.
 * `fallo` es la consulta anterior que dio error, para que la corrija.
 */
export async function planificar(
  historial: MensajeModelo[],
  pregunta: string,
  fallo?: { sql: string; error: string },
): Promise<Plan> {
  const hoy = new Date().toISOString().slice(0, 10);
  const correccion = fallo
    ? `\n\nLa consulta anterior falló:\n${fallo.sql}\nError: ${fallo.error}\nCorrígela.`
    : "";

  const content = await completar(
    [
      { role: "system", content: sistemaPlan(hoy) },
      ...historial,
      { role: "user", content: `Pregunta: ${pregunta}${correccion}` },
    ],
    { json: true, temperature: 0 },
  );

  // Si el modelo no devuelve un plan válido se usa la búsqueda semántica
  try {
    return Plan.parse(leerJson(content));
  } catch {
    return { modo: "semantica" };
  }
}

// Escritura, DDL y funciones que leen ficheros, abren conexiones, ejecutan SQL
// dentro de una cadena o cambian la configuración de la sesión
const PROHIBIDO =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|execute|prepare|deallocate|listen|notify|vacuum|lock|set|reset|set_config|current_setting|pg_\w+|lo_\w+|dblink\w*|\w+_to_xml\w*|xpath\w*)\b/i;

export class SqlNoPermitido extends Error {}

/** Comprueba que la consulta sea un único SELECT sin nada peligroso. */
export function validarSQL(sql: string): string {
  const limpio = sql.trim().replace(/;\s*$/, "");
  // Las cadenas pueden contener cualquier palabra ('%set%'), así que se ignoran
  const sinCadenas = limpio.replace(/'(?:[^']|'')*'/g, "''");

  if (!/^(select|with)\b/i.test(sinCadenas)) {
    throw new SqlNoPermitido("Solo se permiten consultas SELECT");
  }
  if (sinCadenas.includes(";")) {
    throw new SqlNoPermitido("Solo se permite una sentencia");
  }
  if (/--|\/\*/.test(sinCadenas)) {
    throw new SqlNoPermitido("No se permiten comentarios");
  }
  const prohibida = sinCadenas.match(PROHIBIDO);
  if (prohibida) {
    throw new SqlNoPermitido(`Palabra no permitida: ${prohibida[0]}`);
  }
  return limpio;
}

export type ResultadoSQL = {
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
};

/**
 * Ejecuta una consulta ya validada con el usuario de solo lectura, en una
 * transacción READ ONLY que siempre se deshace y con límite de tiempo.
 */
export async function ejecutarSQL(sql: string): Promise<ResultadoSQL> {
  const consulta = validarSQL(sql);
  const client = await poolLectura().connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query(`SET LOCAL statement_timeout = '${TIEMPO_MAXIMO}'`);
    // El protocolo extendido hace que PostgreSQL rechace varias sentencias
    const res = await client.query({
      text: consulta,
      queryMode: "extended",
    } as { text: string });
    return {
      columnas: res.fields.map((f) => f.name),
      filas: res.rows.slice(0, MAX_FILAS),
      truncado: res.rows.length > MAX_FILAS,
    };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}
