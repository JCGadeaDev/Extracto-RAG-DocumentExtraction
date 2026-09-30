import { describe, expect, it } from "vitest";
import { leerJson } from "@/lib/cliente";

describe("leerJson", () => {
  it("devuelve los datos de una respuesta correcta", async () => {
    const res = Response.json({ id: "7" });
    expect(await leerJson(res, "No se pudo subir")).toEqual({ id: "7" });
  });

  it("usa el mensaje de error del servidor cuando lo hay", async () => {
    const res = Response.json({ error: "Documento no encontrado" }, { status: 404 });
    await expect(leerJson(res, "No se pudo analizar")).rejects.toThrow("Documento no encontrado");
  });

  it("explica un error sin cuerpo en lugar del fallo técnico de JSON", async () => {
    const res = new Response(null, { status: 500 });
    await expect(leerJson(res, "No se pudo cargar la lista")).rejects.toThrow(
      "No se pudo cargar la lista: el servidor respondió con un error (500)",
    );
  });

  it("avisa de una respuesta correcta pero vacía", async () => {
    const res = new Response("", { status: 200 });
    await expect(leerJson(res, "No se pudo guardar")).rejects.toThrow("llegó vacía");
  });
});
