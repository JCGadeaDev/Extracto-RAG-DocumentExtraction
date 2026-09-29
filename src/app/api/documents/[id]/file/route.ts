import { pool } from "@/lib/db";

/** Devuelve el archivo original, para abrirlo desde las citas del chat. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/file">,
) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: "Identificador no válido" }, { status: 400 });
  }

  const { rows } = await pool.query<{
    filename: string;
    mime_type: string;
    content: Buffer;
  }>(`SELECT filename, mime_type, content FROM documents WHERE id = $1`, [id]);
  if (rows.length === 0) {
    return Response.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const { filename, mime_type, content } = rows[0];
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": mime_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
