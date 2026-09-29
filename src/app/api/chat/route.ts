import { z } from "zod";
import { responder } from "@/lib/chat";

const Peticion = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(["usuario", "asistente"]),
        texto: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.rol === "usuario", {
      message: "El último mensaje debe ser una pregunta del usuario",
    }),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const peticion = Peticion.safeParse(json);
  if (!peticion.success) {
    return Response.json(
      { error: peticion.error.issues[0]?.message ?? "Petición no válida" },
      { status: 400 },
    );
  }

  try {
    return Response.json(await responder(peticion.data.mensajes));
  } catch (err) {
    console.error("Error en el chat", err);
    return Response.json(
      { error: `No se pudo responder: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
