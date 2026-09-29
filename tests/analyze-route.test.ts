import { beforeEach, describe, expect, it, vi } from "vitest";
import { validarExtraccion } from "@/lib/schemas";
import { facturaValida, sinCampo } from "./fixtures";

const query = vi.fn();
const extractDocument = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/extract", () => ({ extractDocument }));

const { POST } = await import("@/app/api/documents/[id]/analyze/route");

function analizar(id: string) {
  return POST(new Request(`http://test/api/documents/${id}/analyze`, {
    method: "POST",
  }), { params: Promise.resolve({ id }) } as never);
}

/** Primer SELECT: el documento guardado. */
function documentoEnBd(mime = "application/pdf") {
  query.mockResolvedValueOnce({
    rows: [{ mime_type: mime, content: Buffer.from("%PDF-1.4") }],
  });
  query.mockResolvedValueOnce({ rows: [] }); // UPDATE
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PDF analizado con éxito", () => {
  it("devuelve la extracción", async () => {
    documentoEnBd();
    extractDocument.mockResolvedValue(facturaValida);

    const res = await analizar("42");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "42", extraction: facturaValida });
  });

  it("guarda el tipo y el JSON en la base de datos", async () => {
    documentoEnBd();
    extractDocument.mockResolvedValue(facturaValida);

    await analizar("42");

    const [sql, valores] = query.mock.calls[1];
    expect(sql).toContain("UPDATE documents");
    expect(valores).toEqual(["factura", facturaValida, "42"]);
  });

  it("pasa al modelo el contenido y el tipo guardados", async () => {
    documentoEnBd("image/png");
    extractDocument.mockResolvedValue(facturaValida);

    await analizar("42");

    const [contenido, mime] = extractDocument.mock.calls[0];
    expect(contenido.toString()).toBe("%PDF-1.4");
    expect(mime).toBe("image/png");
  });

  it("un documento correcto no da errores de validación", async () => {
    documentoEnBd();
    extractDocument.mockResolvedValue(facturaValida);

    const { extraction } = await (await analizar("42")).json();
    expect(validarExtraccion(extraction)).toEqual({});
  });
});

describe("PDF incompleto", () => {
  it("se guarda igual, pero la validación marca lo que falta", async () => {
    const incompleta = sinCampo(sinCampo(facturaValida, "numero"), "moneda");
    documentoEnBd();
    extractDocument.mockResolvedValue(incompleta);

    const res = await analizar("42");
    const { extraction } = await res.json();

    expect(res.status).toBe(200);
    expect(query.mock.calls[1][0]).toContain("UPDATE documents");
    expect(validarExtraccion(extraction)).toEqual({
      "datos.numero": "Falta este campo obligatorio",
      "datos.moneda": "Falta este campo obligatorio",
    });
  });

  it("un documento ilegible se clasifica como 'otro' sin datos", async () => {
    const vacia = {
      tipo: "otro" as const,
      confianza: 1,
      resumen: "Páginas en blanco",
      datos: {},
    };
    documentoEnBd();
    extractDocument.mockResolvedValue(vacia);

    const { extraction } = await (await analizar("42")).json();

    expect(extraction.tipo).toBe("otro");
    expect(validarExtraccion(extraction)).toEqual({});
  });
});

describe("errores", () => {
  it("rechaza un id que no es numérico", async () => {
    const res = await analizar("../secretos");

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el documento no existe", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await analizar("999");

    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no encontrado/);
    expect(extractDocument).not.toHaveBeenCalled();
  });

  it("devuelve 502 y no guarda nada si falla el modelo", async () => {
    documentoEnBd();
    extractDocument.mockRejectedValue(new Error("Sin saldo suficiente"));

    const res = await analizar("42");

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Sin saldo suficiente");
    expect(query).toHaveBeenCalledTimes(1); // solo el SELECT
  });
});
