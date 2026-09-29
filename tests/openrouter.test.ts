import { beforeEach, describe, expect, it, vi } from "vitest";
import { completar, leerJson } from "@/lib/openrouter";

function respuesta(choice: unknown) {
  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [choice] }),
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = "sk-test";
  globalThis.fetch = vi.fn();
});

describe("completar", () => {
  it("desactiva el razonamiento y pide JSON si se indica", async () => {
    respuesta({ message: { content: " {} " }, finish_reason: "stop" });

    expect(await completar([{ role: "user", content: "hola" }], { json: true })).toBe("{}");

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.reasoning).toEqual({ enabled: false });
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("explica cuándo se agotaron los tokens sin respuesta", async () => {
    respuesta({ message: { content: "" }, finish_reason: "length" });

    await expect(completar([{ role: "user", content: "hola" }])).rejects.toThrow(
      "agotó el límite de tokens",
    );
  });
});

describe("leerJson", () => {
  it("lee el JSON aunque venga envuelto en texto o bloques de código", () => {
    expect(leerJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(leerJson('Aquí tienes: {"a": {"b": 2}}')).toEqual({ a: { b: 2 } });
  });

  it("falla si no hay JSON", () => {
    expect(() => leerJson("nada")).toThrow("no devolvió JSON");
  });
});
