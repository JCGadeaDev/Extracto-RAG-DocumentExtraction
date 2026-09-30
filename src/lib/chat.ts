import { pool, urlLectura } from "@/lib/db";
import { aVector, embeddings } from "@/lib/embeddings";
import {
  ejecutarSQL,
  planificar,
  type Plan,
  type ResultadoSQL,
} from "@/lib/consulta-sql";
import { completar, type MensajeModelo } from "@/lib/openrouter";

// Fragmentos que se recuperan por pregunta; luego se agrupan por documento
const MAX_FRAGMENTOS = 8;
// Mensajes anteriores que se pasan al modelo para entender preguntas de seguimiento
const MAX_HISTORIAL = 6;
// Documentos que se muestran como fuente de un cálculo SQL
const MAX_FUENTES_SQL = 30;
// Filas del resultado que se le pasan al modelo para redactar la respuesta
const MAX_FILAS_MODELO = 50;

export type Mensaje = { rol: "usuario" | "asistente"; texto: string };

export type Fuente = {
  /** Número con el que el modelo cita el documento: [n] */
  n: number;
  document_id: string;
  filename: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  /** Mayor similitud coseno entre sus fragmentos (0–1); null si viene de SQL */
  similitud: number | null;
  /** Fragmentos usados; vacío si viene de SQL */
  fragmentos: string[];
};

export type ConsultaSQL = ResultadoSQL & {
  sql: string;
  /** Documentos que intervienen en el resultado (puede haber más que fuentes) */
  documentos: number;
};

export type RespuestaChat = {
  respuesta: string;
  fuentes: Fuente[];
  modo: "semantica" | "sql";
  consulta?: ConsultaSQL;
};

type Fila = Omit<Fuente, "n" | "fragmentos"> & { texto: string; similitud: number };

export const SIN_DOCUMENTOS =
  "Todavía no hay documentos guardados. Analiza uno y pulsa Confirmar y guardar para poder preguntar sobre él.";

// Título y detalle legibles de cada documento, según su tipo
const METADATOS = `d.filename,
            d.doc_type AS tipo,
            COALESCE(f.numero, r.numero, c.titulo, d.filename)     AS titulo,
            COALESCE(f.emisor_nombre, r.comercio_nombre)           AS detalle`;
const JOINS = `LEFT JOIN facturas  f   ON f.document_id = d.id
       LEFT JOIN recibos   r   ON r.document_id = d.id
       LEFT JOIN contratos c   ON c.document_id = d.id`;

const SYSTEM_SEMANTICA = `Eres el asistente de Extracto y respondes preguntas sobre los documentos del usuario
(facturas, recibos y contratos).

Reglas:
- Usa SOLO la información de los documentos que se te dan. No inventes datos.
- Cita el documento de origen después de cada dato con su número entre corchetes, por ejemplo: "El total es 13,55 EUR [2]".
  Si un dato sale de varios documentos, cítalos todos: [1][3].
- Si los documentos no contienen la respuesta, dilo claramente y no cites nada.
- Responde en español, de forma breve y directa.`;

const SYSTEM_SQL = `Eres el asistente de Extracto y respondes preguntas sobre los documentos del usuario
(facturas, recibos y contratos). Se ha ejecutado una consulta SQL sobre sus datos y tienes el resultado.

Reglas:
- Usa SOLO las cifras del resultado, exactamente como vienen. No recalcules ni inventes datos.
- Escribe los importes en formato español (coma decimal) con su moneda.
- Cita con su número entre corchetes los documentos de la lista que intervienen, por ejemplo: "Has gastado 26,10 EUR [1][2]".
  Si una fila del resultado trae document_id, cítala con el número del documento que tiene ese document_id en la lista.
  Si son más de 5, cita los más relevantes y di cuántos son en total.
- Si el resultado está vacío, di que no hay datos que cumplan la condición.
- Responde en español, de forma breve y directa.`;

/** Busca los fragmentos más parecidos a la consulta entre los documentos confirmados. */
export async function buscarFragmentos(
  consulta: string,
  limite = MAX_FRAGMENTOS,
): Promise<Fila[]> {
  const [vector] = await embeddings([consulta]);
  const { rows } = await pool.query<Fila>(
    `SELECT dc.document_id::text,
            ${METADATOS},
            dc.texto,
            (1 - (dc.embedding <=> $1::vector))::float8            AS similitud
       FROM document_chunks dc
       JOIN documents d        ON d.id = dc.document_id
       ${JOINS}
      WHERE d.confirmed_at IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2`,
    [aVector(vector), limite],
  );
  return rows;
}

/** Agrupa los fragmentos por documento, numerados por orden de relevancia. */
export function agruparPorDocumento(filas: Fila[]): Fuente[] {
  const porDocumento = new Map<string, Fuente>();
  for (const { texto, ...fila } of filas) {
    let fuente = porDocumento.get(fila.document_id);
    if (!fuente) {
      fuente = { ...fila, n: porDocumento.size + 1, fragmentos: [] };
      porDocumento.set(fila.document_id, fuente);
    }
    fuente.fragmentos.push(texto);
    fuente.similitud = Math.max(fuente.similitud ?? 0, fila.similitud);
  }
  return [...porDocumento.values()];
}

const CITA = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Números citados en la respuesta, en orden de aparición y sin repetir. */
export function citas(respuesta: string): number[] {
  const vistos = new Set<number>();
  for (const m of respuesta.matchAll(CITA)) {
    for (const n of m[1].split(",")) vistos.add(Number(n.trim()));
  }
  return [...vistos];
}

function cabecera(f: Fuente): string {
  // El document_id permite relacionar las filas de un resultado SQL con su número
  const partes = [`document_id ${f.document_id}`, f.tipo, f.titulo, f.detalle, `archivo ${f.filename}`];
  return `[${f.n}] ${partes.filter(Boolean).join(" · ")}`;
}

function contexto(fuentes: Fuente[]): string {
  return fuentes
    .map((f) => `${cabecera(f)}\n${f.fragmentos.join("\n…\n")}`)
    .join("\n\n---\n\n");
}

async function responderSemantica(
  historial: MensajeModelo[],
  consulta: string,
  pregunta: string,
): Promise<RespuestaChat> {
  const fuentes = agruparPorDocumento(await buscarFragmentos(consulta));
  if (fuentes.length === 0) {
    return { respuesta: SIN_DOCUMENTOS, fuentes: [], modo: "semantica" };
  }

  const respuesta = await completar([
    { role: "system", content: SYSTEM_SEMANTICA },
    ...historial,
    {
      role: "user",
      content: `Documentos:\n\n${contexto(fuentes)}\n\nPregunta: ${pregunta}`,
    },
  ]);

  // Solo se devuelven los documentos citados; se ignoran números inventados
  return {
    respuesta,
    modo: "semantica",
    fuentes: citas(respuesta)
      .map((n) => fuentes.find((f) => f.n === n))
      .filter((f): f is Fuente => f !== undefined),
  };
}

/** Datos de los documentos que devuelve la consulta de documentos del plan. */
async function fuentesDeDocumentos(ids: string[]): Promise<Fuente[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<Omit<Fuente, "n" | "fragmentos" | "similitud">>(
    `SELECT d.id::text AS document_id,
            ${METADATOS}
       FROM documents d
       ${JOINS}
      WHERE d.id = ANY($1::bigint[]) AND d.confirmed_at IS NOT NULL
      ORDER BY d.id`,
    [ids.slice(0, MAX_FUENTES_SQL)],
  );
  return rows.map((r, i) => ({ ...r, n: i + 1, similitud: null, fragmentos: [] }));
}

/** Ids de documento de la consulta de documentos; si falla, no hay fuentes. */
async function idsDeDocumentos(sql: string | null | undefined): Promise<string[]> {
  if (!sql) return [];
  try {
    const { filas } = await ejecutarSQL(sql);
    return [
      ...new Set(
        filas
          .map((f) => f.document_id ?? Object.values(f)[0])
          .filter((id) => id !== null && id !== undefined)
          .map(String)
          .filter((id) => /^\d+$/.test(id)),
      ),
    ];
  } catch (err) {
    console.error("Falló la consulta de documentos", err);
    return [];
  }
}

async function responderSQL(
  historial: MensajeModelo[],
  pregunta: string,
  sql: string,
  resultado: ResultadoSQL,
  sqlDocumentos: string | null | undefined,
): Promise<RespuestaChat> {
  const ids = await idsDeDocumentos(sqlDocumentos);
  const fuentes = await fuentesDeDocumentos(ids);

  const filas = resultado.filas.slice(0, MAX_FILAS_MODELO);
  const recorte =
    resultado.filas.length > filas.length || resultado.truncado
      ? `\n(Se muestran ${filas.length} filas; el resultado tiene más.)`
      : "";
  const documentos = fuentes.length
    ? `Documentos que intervienen (${ids.length} en total):\n${fuentes.map(cabecera).join("\n")}`
    : "No se pudo determinar qué documentos intervienen; no cites ninguno.";

  const respuesta = await completar([
    { role: "system", content: SYSTEM_SQL },
    ...historial,
    {
      role: "user",
      content: `Pregunta: ${pregunta}\n\nConsulta:\n${sql}\n\nResultado (${resultado.filas.length} filas):\n${JSON.stringify(filas)}${recorte}\n\n${documentos}`,
    },
  ]);

  return {
    respuesta,
    modo: "sql",
    fuentes,
    consulta: { sql, ...resultado, documentos: ids.length },
  };
}

export async function responder(mensajes: Mensaje[]): Promise<RespuestaChat> {
  const pregunta = mensajes.at(-1)!.texto;
  const historial: MensajeModelo[] = mensajes
    .slice(-MAX_HISTORIAL - 1, -1)
    .map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto }));

  // Cálculos y totales: SQL sobre las tablas. Se reintenta una vez corrigiendo
  // el error; si vuelve a fallar se responde con la búsqueda semántica. Sin
  // usuario de solo lectura (p. ej. servidores que no permiten crear roles) no
  // se intenta: el SQL generado nunca se ejecuta con el usuario principal.
  let plan: Plan = urlLectura()
    ? await planificar(historial, pregunta)
    : { modo: "semantica" };
  for (let intento = 0; plan.modo === "sql" && intento < 2; intento++) {
    let resultado: ResultadoSQL;
    try {
      resultado = await ejecutarSQL(plan.sql);
    } catch (err) {
      console.error("Falló la consulta SQL generada", plan.sql, err);
      if (intento === 1) break;
      plan = await planificar(historial, pregunta, {
        sql: plan.sql,
        error: (err as Error).message,
      });
      continue;
    }
    return responderSQL(historial, pregunta, plan.sql, resultado, plan.sql_documentos);
  }

  // La pregunta anterior ayuda a recuperar el contexto de un seguimiento ("¿y cuándo vence?")
  const anterior = mensajes.slice(0, -1).findLast((m) => m.rol === "usuario");
  const consulta = anterior ? `${anterior.texto}\n${pregunta}` : pregunta;
  return responderSemantica(historial, consulta, pregunta);
}
