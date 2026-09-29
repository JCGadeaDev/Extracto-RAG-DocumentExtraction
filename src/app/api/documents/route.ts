import { pool } from "@/lib/db";

export type DocumentoGuardado = {
  id: string;
  filename: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  chunks: number;
  confirmed_at: string;
  importe: number | null;
  moneda: string | null;
};

/** Documentos ya confirmados, del más reciente al más antiguo. */
export async function GET() {
  const { rows } = await pool.query<DocumentoGuardado>(
    `SELECT d.id::text,
            d.filename,
            d.doc_type AS tipo,
            COALESCE(f.numero, r.numero, c.titulo, d.filename)        AS titulo,
            COALESCE(f.emisor_nombre, r.comercio_nombre,
                     (SELECT string_agg(p.nombre, ' · ' ORDER BY p.posicion)
                        FROM partes p WHERE p.document_id = d.id))    AS detalle,
            to_char(COALESCE(f.fecha_emision, r.fecha, c.fecha_firma), 'YYYY-MM-DD') AS fecha,
            (SELECT count(*)::int FROM document_chunks dc
              WHERE dc.document_id = d.id)                            AS chunks,
            to_char(d.confirmed_at, 'YYYY-MM-DD HH24:MI')             AS confirmed_at,
            COALESCE(f.total, r.total, c.importe)::float8             AS importe,
            COALESCE(f.moneda, r.moneda, c.moneda)                    AS moneda
       FROM documents d
       LEFT JOIN facturas  f ON f.document_id = d.id
       LEFT JOIN recibos   r ON r.document_id = d.id
       LEFT JOIN contratos c ON c.document_id = d.id
      WHERE d.confirmed_at IS NOT NULL
      ORDER BY d.confirmed_at DESC
      LIMIT 50`,
  );

  return Response.json({ documentos: rows });
}
