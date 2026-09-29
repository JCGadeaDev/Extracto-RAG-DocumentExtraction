import { beforeEach, describe, expect, it, vi } from "vitest";
import { conDatos, facturaValida, sinCampo } from "./fixtures";

const query = vi.fn();
const guardarConfirmado = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/persist", () => ({ guardarConfirmado }));

const { POST } = await import("@/app/api/documents/[id]/confirm/route");

function confirmar(id: string, body: unknown) {
  return POST(
    new Request(`http://test/api/documents/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  query.mockResolvedValue({ rows: [{ texto: "texto guardado" }] });
  guardarConfirmado.mockResolvedValue({ chunks: 3 });
});

describe("confirmación correcta", () => {
  it("guarda y devuelve cuántos fragmentos se indexaron", async () => {
    const res = await confirmar("7", { extraction: facturaValida });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "7", chunks: 3 });
  });

  it("guarda la extracción revisada y su transcripción", async () => {
    await confirmar("7", { extraction: facturaValida });

    const [id, extraction, texto] = guardarConfirmado.mock.calls[0];
    expect(id).toBe("7");
    expect(extraction.datos).toEqual(facturaValida.datos);
    expect(texto).toBe(facturaValida.texto);
  });

  it("usa el texto de la base de datos si la extracción no lo trae", async () => {
    const sinTexto = { ...facturaValida, texto: "" };

    await confirmar("7", { extraction: sinTexto });

    expect(guardarConfirmado.mock.calls[0][2]).toBe("texto guardado");
  });
});

describe("confirmación rechazada", () => {
  it("rechaza un id que no es numérico", async () => {
    const res = await confirmar("abc", { extraction: facturaValida });

    expect(res.status).toBe(400);
    expect(guardarConfirmado).not.toHaveBeenCalled();
  });

  it("rechaza un cuerpo sin extracción", async () => {
    const res = await confirmar("7", {});

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/formato esperado/);
  });

  it("no guarda un documento al que le faltan campos obligatorios", async () => {
    const res = await confirmar("7", {
      extraction: sinCampo(facturaValida, "numero"),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).issues).toEqual({
      "datos.numero": "Falta este campo obligatorio",
    });
    expect(guardarConfirmado).not.toHaveBeenCalled();
  });

  it("no guarda un documento cuyos importes no cuadran", async () => {
    const res = await confirmar("7", {
      extraction: conDatos(facturaValida, { total: 99 }),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).issues["datos.total"]).toMatch(/No cuadra/);
    expect(guardarConfirmado).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el documento no existe", async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await confirmar("999", { extraction: facturaValida });

    expect(res.status).toBe(404);
    expect(guardarConfirmado).not.toHaveBeenCalled();
  });

  it("devuelve 502 si falla el guardado", async () => {
    guardarConfirmado.mockRejectedValue(new Error("Sin saldo"));

    const res = await confirmar("7", { extraction: facturaValida });

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Sin saldo");
  });
});
