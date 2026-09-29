import { pool } from "@/lib/db";
import { extractDocument } from "@/lib/extract";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/analyze">,
) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: "Identificador no válido" }, { status: 400 });
  }

  const { rows } = await pool.query<{ mime_type: string; content: Buffer }>(
    `SELECT mime_type, content FROM documents WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return Response.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  try {
    const extraction = await extractDocument(rows[0].content, rows[0].mime_type);
    await pool.query(
      `UPDATE documents SET doc_type = $1, extraction = $2 WHERE id = $3`,
      [extraction.tipo, extraction, id],
    );
    return Response.json({ id, extraction });
  } catch (err) {
    console.error("Error en la extracción", err);
    return Response.json(
      { error: `Falló el análisis: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
