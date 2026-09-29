import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVector, DIMENSIONES, embeddings, trocear } from "@/lib/embeddings";

function vector(valor = 0.1) {
  return new Array(DIMENSIONES).fill(valor);
}

function respuesta(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => (ok ? { data } : { error: { message: data } }),
  } as Response;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENROUTER_EMBEDDING_MODEL;
});

describe("trocear", () => {
  it("deja un texto corto en un solo fragmento", () => {
    expect(trocear("Factura F-1\nTotal: 10 EUR")).toEqual([
      "Factura F-1\nTotal: 10 EUR",
    ]);
  });

  it("no devuelve nada si el texto está vacío", () => {
    expect(trocear("   \n  ")).toEqual([]);
  });

  it("parte un texto largo en varios fragmentos", () => {
    const linea = "Concepto de ejemplo con su importe\n";
    const fragmentos = trocear(linea.repeat(200));

    expect(fragmentos.length).toBeGreaterThan(1);
    fragmentos.forEach((f) => expect(f.length).toBeLessThanOrEqual(1000));
  });

  it("corta por saltos de línea y solapa los fragmentos", () => {
    const fragmentos = trocear(
      Array.from({ length: 150 }, (_, i) => `Linea ${i}`).join("\n"),
    );

    expect(fragmentos[0].endsWith("\n")).toBe(false);
    // El solape hace que el final del primero reaparezca en el segundo
    const cola = fragmentos[0].slice(-40);
    expect(fragmentos[1]).toContain(cola.split("\n").at(-1)!);
  });
});

describe("embeddings", () => {
  it("no llama a la API si no hay nada que convertir", async () => {
    expect(await embeddings([])).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("devuelve un vector por fragmento", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta([
        { index: 0, embedding: vector(0.1) },
        { index: 1, embedding: vector(0.2) },
      ]),
    );

    const vectores = await embeddings(["uno", "dos"]);

    expect(vectores).toHaveLength(2);
    expect(vectores[0][0]).toBe(0.1);
    expect(vectores[1][0]).toBe(0.2);
  });

  it("respeta el índice aunque la API los devuelva desordenados", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta([
        { index: 1, embedding: vector(0.2) },
        { index: 0, embedding: vector(0.1) },
      ]),
    );

    const vectores = await embeddings(["uno", "dos"]);
    expect(vectores[0][0]).toBe(0.1);
    expect(vectores[1][0]).toBe(0.2);
  });

  it("usa el modelo configurable", async () => {
    process.env.OPENROUTER_EMBEDDING_MODEL = "otro/embed";
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta([{ index: 0, embedding: vector() }]),
    );

    await embeddings(["uno"]);

    const body = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    expect(body.model).toBe("otro/embed");
    expect(body.input).toEqual(["uno"]);
  });

  it("falla si falta la clave", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(embeddings(["uno"])).rejects.toThrow("Falta OPENROUTER_API_KEY");
  });

  it("propaga el error de OpenRouter", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta("Sin saldo", false, 402),
    );
    await expect(embeddings(["uno"])).rejects.toThrow("Sin saldo");
  });

  it("falla si faltan vectores", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta([{ index: 0, embedding: vector() }]),
    );
    await expect(embeddings(["uno", "dos"])).rejects.toThrow(
      "un embedding por fragmento",
    );
  });

  it("falla si las dimensiones no son las de la tabla", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuesta([{ index: 0, embedding: [1, 2, 3] }]),
    );
    await expect(embeddings(["uno"])).rejects.toThrow(
      `devolvió 3 dimensiones y la tabla espera ${DIMENSIONES}`,
    );
  });
});

describe("aVector", () => {
  it("usa el formato de pgvector", () => {
    expect(aVector([0.1, -0.2, 3])).toBe("[0.1,-0.2,3]");
  });
});
