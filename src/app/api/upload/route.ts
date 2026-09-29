import { pool } from "@/lib/db";

const ALLOWED = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/;
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (!ALLOWED.test(file.type)) {
    return Response.json({ error: "Solo se aceptan imágenes o PDF" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "El archivo supera los 20 MB" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO documents (filename, mime_type, size_bytes, content)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [file.name, file.type, file.size, bytes],
  );

  return Response.json({ id: rows[0].id }, { status: 201 });
}
