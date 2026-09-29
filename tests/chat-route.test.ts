import { beforeEach, describe, expect, it, vi } from "vitest";

const responder = vi.fn();
vi.mock("@/lib/chat", () => ({ responder }));

const { POST } = await import("@/app/api/chat/route");

function preguntar(body: unknown) {
  return POST(
    new Request("http://test/api/chat", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ruta del chat", () => {
  it("devuelve la respuesta con sus fuentes", async () => {
    const r = { respuesta: "13,55 EUR [1]", fuentes: [{ n: 1, document_id: "7" }] };
    responder.mockResolvedValue(r);

    const res = await preguntar({ mensajes: [{ rol: "usuario", texto: "¿Total?" }] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(r);
    expect(responder).toHaveBeenCalledWith([{ rol: "usuario", texto: "¿Total?" }]);
  });

  it("rechaza un JSON roto", async () => {
    expect((await preguntar("{no")).status).toBe(400);
  });

  it("rechaza una pregunta vacía", async () => {
    const res = await preguntar({ mensajes: [{ rol: "usuario", texto: "   " }] });
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("exige que el último mensaje sea del usuario", async () => {
    const res = await preguntar({
      mensajes: [
        { rol: "usuario", texto: "hola" },
        { rol: "asistente", texto: "hola" },
      ],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("último mensaje");
  });

  it("devuelve 502 si falla el modelo", async () => {
    responder.mockRejectedValue(new Error("Sin saldo"));

    const res = await preguntar({ mensajes: [{ rol: "usuario", texto: "?" }] });

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Sin saldo");
  });
});
