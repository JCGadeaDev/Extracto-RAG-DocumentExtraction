import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { aVector, embeddings, trocear } from "@/lib/embeddings";
import type { Extraction } from "@/lib/schemas";

type Datos = Record<string, unknown>;

function texto(datos: Datos, campo: string): string | null {
  const v = datos[campo];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function numero(datos: Datos, campo: string): number | null {
  const v = datos[campo];
  return typeof v === "number" ? v : null;
}

function objeto(datos: Datos, campo: string): Datos {
  const v = datos[campo];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Datos) : {};
}

function lista(datos: Datos, campo: string): Datos[] {
  const v = datos[campo];
  return Array.isArray(v) ? v.map((i) => (i && typeof i === "object" ? i : {})) : [];
}

async function guardarConceptos(db: PoolClient, id: string, datos: Datos) {
  const conceptos = lista(datos, "conceptos");
  for (const [i, c] of conceptos.entries()) {
    await db.query(
      `INSERT INTO conceptos (document_id, posicion, descripcion, cantidad, precio_unitario, importe)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, i, texto(c, "descripcion"), numero(c, "cantidad"), numero(c, "precio_unitario"), numero(c, "importe")],
    );
  }
}

async function guardarImpuestos(db: PoolClient, id: string, datos: Datos) {
  for (const [i, imp] of lista(datos, "impuestos").entries()) {
    await db.query(
      `INSERT INTO impuestos (document_id, posicion, tipo, tasa, importe)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, i, texto(imp, "tipo"), numero(imp, "tasa"), numero(imp, "importe")],
    );
  }
}

/** Inserta los datos del documento en la tabla que le corresponde por tipo. */
async function guardarDatos(db: PoolClient, id: string, extraction: Extraction) {
  const d = extraction.datos;

  if (extraction.tipo === "factura") {
    const emisor = objeto(d, "emisor");
    const receptor = objeto(d, "receptor");
    await db.query(
      `INSERT INTO facturas (document_id, numero, fecha_emision, fecha_vencimiento,
         emisor_nombre, emisor_id_fiscal, emisor_direccion,
         receptor_nombre, receptor_id_fiscal, receptor_direccion,
         subtotal, total, moneda, forma_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id, texto(d, "numero"), texto(d, "fecha_emision"), texto(d, "fecha_vencimiento"),
        texto(emisor, "nombre"), texto(emisor, "id_fiscal"), texto(emisor, "direccion"),
        texto(receptor, "nombre"), texto(receptor, "id_fiscal"), texto(receptor, "direccion"),
        numero(d, "subtotal"), numero(d, "total"), texto(d, "moneda"), texto(d, "forma_pago"),
      ],
    );
    await guardarConceptos(db, id, d);
    await guardarImpuestos(db, id, d);
    return;
  }

  if (extraction.tipo === "recibo") {
    const comercio = objeto(d, "comercio");
    await db.query(
      `INSERT INTO recibos (document_id, numero, fecha, comercio_nombre,
         comercio_id_fiscal, comercio_direccion, subtotal, total, moneda, metodo_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, texto(d, "numero"), texto(d, "fecha"), texto(comercio, "nombre"),
        texto(comercio, "id_fiscal"), texto(comercio, "direccion"),
        numero(d, "subtotal"), numero(d, "total"), texto(d, "moneda"), texto(d, "metodo_pago"),
      ],
    );
    await guardarConceptos(db, id, d);
    await guardarImpuestos(db, id, d);
    return;
  }

  if (extraction.tipo === "contrato") {
    await db.query(
      `INSERT INTO contratos (document_id, titulo, tipo_contrato, fecha_firma,
         fecha_inicio, fecha_fin, objeto, importe, moneda, condiciones_pago, duracion, jurisdiccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id, texto(d, "titulo"), texto(d, "tipo_contrato"), texto(d, "fecha_firma"),
        texto(d, "fecha_inicio"), texto(d, "fecha_fin"), texto(d, "objeto"),
        numero(d, "importe"), texto(d, "moneda"), texto(d, "condiciones_pago"),
        texto(d, "duracion"), texto(d, "jurisdiccion"),
      ],
    );
    for (const [i, p] of lista(d, "partes").entries()) {
      await db.query(
        `INSERT INTO partes (document_id, posicion, nombre, rol, id_fiscal, direccion)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, i, texto(p, "nombre"), texto(p, "rol"), texto(p, "id_fiscal"), texto(p, "direccion")],
      );
    }
    const clausulas = Array.isArray(d.clausulas_clave) ? d.clausulas_clave : [];
    for (const [i, c] of clausulas.entries()) {
      if (typeof c !== "string" || !c.trim()) continue;
      await db.query(
        `INSERT INTO clausulas (document_id, posicion, texto) VALUES ($1,$2,$3)`,
        [id, i, c],
      );
    }
  }
  // "otro" no tiene tabla propia: se queda en documents.extraction
}

/** Borra lo guardado antes, para que confirmar dos veces no duplique filas. */
async function limpiar(db: PoolClient, id: string) {
  for (const tabla of [
    "facturas", "recibos", "contratos",
    "conceptos", "impuestos", "partes", "clausulas", "document_chunks",
  ]) {
    await db.query(`DELETE FROM ${tabla} WHERE document_id = $1`, [id]);
  }
}

export type ResultadoGuardado = { chunks: number };

/**
 * Guarda los datos revisados en sus tablas y el texto del documento como
 * embeddings, todo en una transacción: o entra completo o no entra nada.
 */
export async function guardarConfirmado(
  id: string,
  extraction: Extraction,
  textoDocumento: string,
): Promise<ResultadoGuardado> {
  const fragmentos = trocear(textoDocumento);
  // Fuera de la transacción: es una llamada de red y puede fallar
  const vectores = await embeddings(fragmentos);

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await limpiar(db, id);
    await guardarDatos(db, id, extraction);

    for (const [i, fragmento] of fragmentos.entries()) {
      await db.query(
        `INSERT INTO document_chunks (document_id, posicion, texto, embedding)
         VALUES ($1, $2, $3, $4)`,
        [id, i, fragmento, aVector(vectores[i])],
      );
    }

    await db.query(
      `UPDATE documents
          SET doc_type = $1, extraction = $2, texto = $3, confirmed_at = now()
        WHERE id = $4`,
      [extraction.tipo, extraction, textoDocumento, id],
    );
    await db.query("COMMIT");
    return { chunks: fragmentos.length };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}
