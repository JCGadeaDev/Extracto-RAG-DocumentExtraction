import { pool } from "@/lib/db";
import { guardarConfirmado } from "@/lib/persist";
import { extractionSchema, validarExtraccion } from "@/lib/schemas";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/documents/[id]/confirm">,
) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: "Identificador no válido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = extractionSchema.safeParse(body?.extraction);
  if (!parsed.success) {
    return Response.json(
      { error: "La extracción enviada no tiene el formato esperado" },
      { status: 400 },
    );
  }
  const extraction = parsed.data;

  // Se revalida en el servidor: el cliente puede haber enviado cualquier cosa
  const issues = validarExtraccion(extraction);
  if (Object.keys(issues).length > 0) {
    return Response.json(
      { error: "Hay campos sin corregir", issues },
      { status: 422 },
    );
  }

  const { rows } = await pool.query<{ texto: string | null }>(
    `SELECT texto FROM documents WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return Response.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  try {
    const resultado = await guardarConfirmado(
      id,
      extraction,
      extraction.texto || rows[0].texto || extraction.resumen,
    );
    return Response.json({ id, ...resultado });
  } catch (err) {
    console.error("Error al confirmar", err);
    return Response.json(
      { error: `No se pudo guardar: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
