import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderPageAsImage = vi.fn();
const getDocumentProxy = vi.fn();
vi.mock("unpdf", () => ({ getDocumentProxy, renderPageAsImage }));

const { extractDocument } = await import("@/lib/extract");

type Body = {
  model: string;
  messages: { role: string; content: unknown }[];
  max_tokens: number;
  plugins?: unknown;
};

/** Última petición enviada a OpenRouter. */
function ultimaPeticion(): Body {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  return JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
}

function respuestaModelo(content: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () =>
      ok
        ? { choices: [{ message: { content } }] }
        : { error: { message: content } },
  };
}

const JSON_VALIDO = JSON.stringify({
  tipo: "factura",
  confianza: 0.9,
  resumen: "Una factura",
  datos: { numero: "F-1", total: 10 },
});

const PNG = Buffer.from("imagen-falsa");

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  globalThis.fetch = vi.fn();
  getDocumentProxy.mockResolvedValue({ numPages: 3, cleanup: vi.fn() });
  renderPageAsImage.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENROUTER_MODEL;
});

describe("imágenes", () => {
  it("devuelve la extracción del modelo", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    const extraccion = await extractDocument(PNG, "image/png");

    expect(extraccion.tipo).toBe("factura");
    expect(extraccion.datos).toEqual({ numero: "F-1", total: 10 });
  });

  it("envía la imagen como data URL y no usa unpdf", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(PNG, "image/jpeg");

    const content = ultimaPeticion().messages[1].content as {
      type: string;
      image_url?: { url: string };
    }[];
    expect(content[0].type).toBe("image_url");
    expect(content[0].image_url!.url).toBe(
      `data:image/jpeg;base64,${PNG.toString("base64")}`,
    );
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });

  it("acepta un JSON envuelto en ```json", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo("```json\n" + JSON_VALIDO + "\n```") as Response,
    );

    const extraccion = await extractDocument(PNG, "image/png");
    expect(extraccion.tipo).toBe("factura");
  });

  it("convierte un tipo desconocido en 'otro'", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(
        JSON.stringify({ tipo: "albaran", confianza: 1, resumen: "", datos: {} }),
      ) as Response,
    );

    const extraccion = await extractDocument(PNG, "image/png");
    expect(extraccion.tipo).toBe("otro");
  });

  it("rellena los campos que el modelo omite", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON.stringify({ tipo: "recibo" })) as Response,
    );

    const extraccion = await extractDocument(PNG, "image/png");
    expect(extraccion).toEqual({
      tipo: "recibo",
      confianza: 0,
      resumen: "",
      texto: "",
      datos: {},
    });
  });

  it("limita los tokens para no reservar todo el saldo", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(PNG, "image/png");
    expect(ultimaPeticion().max_tokens).toBe(8192);
  });

  it("usa el modelo de OPENROUTER_MODEL si está definido", async () => {
    process.env.OPENROUTER_MODEL = "otro/modelo";
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(PNG, "image/png");
    expect(ultimaPeticion().model).toBe("otro/modelo");
  });
});

describe("PDFs", () => {
  it("envía una imagen por página y no usa plugins de OpenRouter", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(Buffer.from("%PDF-1.4"), "application/pdf");

    const peticion = ultimaPeticion();
    const content = peticion.messages[1].content as { type: string }[];
    expect(renderPageAsImage).toHaveBeenCalledTimes(3);
    expect(content.filter((c) => c.type === "image_url")).toHaveLength(3);
    expect(peticion.plugins).toBeUndefined();
  });

  it("avisa al modelo de que las imágenes son páginas del mismo documento", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(Buffer.from("%PDF-1.4"), "application/pdf");

    const content = ultimaPeticion().messages[1].content as {
      type: string;
      text?: string;
    }[];
    expect(content.at(-1)!.text).toContain("3 imágenes");
  });

  it("no manda más de 10 páginas", async () => {
    getDocumentProxy.mockResolvedValue({ numPages: 40, cleanup: vi.fn() });
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo(JSON_VALIDO) as Response,
    );

    await extractDocument(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(renderPageAsImage).toHaveBeenCalledTimes(10);
  });
});

describe("errores", () => {
  it("avisa si falta la clave de OpenRouter", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(extractDocument(PNG, "image/png")).rejects.toThrow(
      "Falta OPENROUTER_API_KEY",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("propaga el mensaje de error de OpenRouter", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo("Sin saldo suficiente", false, 402) as Response,
    );

    await expect(extractDocument(PNG, "image/png")).rejects.toThrow(
      "Sin saldo suficiente",
    );
  });

  it("falla si el modelo no devuelve contenido", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    } as Response);

    await expect(extractDocument(PNG, "image/png")).rejects.toThrow(
      "no devolvió contenido",
    );
  });

  it("falla si el modelo devuelve algo que no es JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respuestaModelo("No puedo leer este documento") as Response,
    );

    await expect(extractDocument(PNG, "image/png")).rejects.toThrow(
      "JSON no válido",
    );
  });
});
