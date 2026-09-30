import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const urlLectura = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query }, urlLectura }));
const planificar = vi.fn();
const ejecutarSQL = vi.fn();
vi.mock("@/lib/consulta-sql", () => ({ planificar, ejecutarSQL }));
const embeddings = vi.fn();
vi.mock("@/lib/embeddings", async (original) => ({
  ...(await original<typeof import("@/lib/embeddings")>()),
  embeddings,
}));

const { agruparPorDocumento, citas, responder, SIN_DOCUMENTOS } = await import(
  "@/lib/chat"
);

function fila(document_id: string, texto: string, similitud = 0.8) {
  return {
    document_id,
    filename: `doc${document_id}.png`,
    tipo: "factura",
    titulo: `F-${document_id}`,
    detalle: "Papeleria Lopez S.L.",
    texto,
    similitud,
  };
}

function respuestaModelo(content: string) {
  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response);
}

function cuerpoEnviado() {
  return JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = "sk-test";
  globalThis.fetch = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  planificar.mockResolvedValue({ modo: "semantica" });
  urlLectura.mockReturnValue("postgres://lector:x@host/db");
  embeddings.mockResolvedValue([new Array(1024).fill(0.1)]);
  query.mockResolvedValue({
    rows: [
      fila("7", "Total: 13,55 EUR", 0.9),
      fila("9", "Renta 1.800"),
      fila("7", "Cuadernos x3"),
    ],
  });
});

describe("citas", () => {
  it("extrae los números citados sin repetir y en orden", () => {
    expect(citas("Total 13,55 [2]. Emisor López [1][2]. Otro [3, 1]")).toEqual([2, 1, 3]);
  });

  it("no encuentra nada si no hay citas", () => {
    expect(citas("No lo encuentro en tus documentos.")).toEqual([]);
  });
});

describe("agruparPorDocumento", () => {
  it("junta los fragmentos del mismo documento y numera por relevancia", () => {
    const fuentes = agruparPorDocumento([
      fila("7", "a", 0.9),
      fila("9", "b", 0.7),
      fila("7", "c", 0.6),
    ]);

    expect(fuentes.map((f) => [f.n, f.document_id, f.fragmentos])).toEqual([
      [1, "7", ["a", "c"]],
      [2, "9", ["b"]],
    ]);
    expect(fuentes[0].similitud).toBe(0.9);
  });
});

describe("responder", () => {
  it("devuelve solo las fuentes citadas", async () => {
    respuestaModelo("El total fue 13,55 EUR [1].");

    const r = await responder([{ rol: "usuario", texto: "¿Cuánto costó?" }]);

    expect(r.respuesta).toBe("El total fue 13,55 EUR [1].");
    expect(r.fuentes).toHaveLength(1);
    expect(r.fuentes[0]).toMatchObject({
      n: 1,
      document_id: "7",
      filename: "doc7.png",
      fragmentos: ["Total: 13,55 EUR", "Cuadernos x3"],
    });
  });

  it("ignora citas a documentos que no se le dieron", async () => {
    respuestaModelo("Dato [2] y dato inventado [5].");

    const r = await responder([{ rol: "usuario", texto: "?" }]);

    expect(r.fuentes.map((f) => f.n)).toEqual([2]);
  });

  it("sin citas no devuelve fuentes", async () => {
    respuestaModelo("No aparece en tus documentos.");

    const r = await responder([{ rol: "usuario", texto: "¿Y el IBAN?" }]);

    expect(r.fuentes).toEqual([]);
  });

  it("busca por similitud solo entre documentos confirmados", async () => {
    respuestaModelo("x");

    await responder([{ rol: "usuario", texto: "cuadernos" }]);

    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("ORDER BY dc.embedding <=> $1::vector");
    expect(sql).toContain("d.confirmed_at IS NOT NULL");
    expect(valores[0]).toMatch(/^\[0\.1,/);
  });

  it("pasa al modelo los documentos numerados y la pregunta", async () => {
    respuestaModelo("x");

    await responder([{ rol: "usuario", texto: "¿Cuánto costó?" }]);

    const ultimo = cuerpoEnviado().messages.at(-1).content;
    expect(ultimo).toContain("[1] document_id 7 · factura · F-7 · Papeleria Lopez S.L. · archivo doc7.png");
    expect(ultimo).toContain("[2] document_id 9 · factura · F-9");
    expect(ultimo).toContain("Pregunta: ¿Cuánto costó?");
  });

  it("usa la pregunta anterior para buscar y pasa el historial", async () => {
    respuestaModelo("x");

    await responder([
      { rol: "usuario", texto: "¿Qué factura es de López?" },
      { rol: "asistente", texto: "La F-7 [1]." },
      { rol: "usuario", texto: "¿Y cuándo vence?" },
    ]);

    expect(embeddings).toHaveBeenCalledWith([
      "¿Qué factura es de López?\n¿Y cuándo vence?",
    ]);
    const roles = cuerpoEnviado().messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user"]);
  });

  it("no llama al modelo si no hay documentos guardados", async () => {
    query.mockResolvedValue({ rows: [] });

    const r = await responder([{ rol: "usuario", texto: "hola" }]);

    expect(r).toEqual({ respuesta: SIN_DOCUMENTOS, fuentes: [], modo: "semantica" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("propaga el error de OpenRouter", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: "Sin saldo" } }),
    } as Response);

    await expect(responder([{ rol: "usuario", texto: "?" }])).rejects.toThrow(
      "Sin saldo",
    );
  });
});

describe("preguntas de cálculo con SQL", () => {
  const sql = "SELECT moneda, sum(total) AS total_gastado FROM facturas GROUP BY moneda";
  const sqlDocumentos = "SELECT DISTINCT document_id FROM facturas";
  const resultado = {
    columnas: ["moneda", "total_gastado"],
    filas: [{ moneda: "EUR", total_gastado: "26.10" }],
    truncado: false,
  };
  const metadatos = [
    { document_id: "7", filename: "doc7.png", tipo: "factura", titulo: "F-7", detalle: "Lopez" },
    { document_id: "9", filename: "doc9.pdf", tipo: "factura", titulo: "F-9", detalle: null },
  ];

  beforeEach(() => {
    planificar.mockResolvedValue({ modo: "sql", sql, sql_documentos: sqlDocumentos });
    ejecutarSQL.mockImplementation(async (q: string) =>
      q === sqlDocumentos
        ? {
            columnas: ["document_id"],
            filas: [{ document_id: "7" }, { document_id: "9" }],
            truncado: false,
          }
        : resultado,
    );
    query.mockResolvedValue({ rows: metadatos });
  });

  it("responde con el resultado de la consulta y sus documentos", async () => {
    respuestaModelo("Has gastado 26,10 EUR [1][2].");

    const r = await responder([{ rol: "usuario", texto: "¿Cuánto he gastado?" }]);

    expect(r.modo).toBe("sql");
    expect(r.respuesta).toBe("Has gastado 26,10 EUR [1][2].");
    expect(r.consulta).toEqual({ sql, ...resultado, documentos: 2 });
    expect(r.fuentes.map((f) => [f.n, f.document_id, f.similitud])).toEqual([
      [1, "7", null],
      [2, "9", null],
    ]);
    expect(embeddings).not.toHaveBeenCalled();
  });

  it("pasa al modelo el resultado y los documentos numerados", async () => {
    respuestaModelo("x");

    await responder([{ rol: "usuario", texto: "¿Cuánto he gastado?" }]);

    const ultimo = cuerpoEnviado().messages.at(-1).content;
    expect(ultimo).toContain('[{"moneda":"EUR","total_gastado":"26.10"}]');
    expect(ultimo).toContain("[1] document_id 7 · factura · F-7 · Lopez · archivo doc7.png");
    expect(ultimo).toContain("(2 en total)");
  });

  it("busca los metadatos solo de documentos confirmados", async () => {
    respuestaModelo("x");

    await responder([{ rol: "usuario", texto: "?" }]);

    const [sqlMeta, valores] = query.mock.calls[0];
    expect(sqlMeta).toContain("d.confirmed_at IS NOT NULL");
    expect(valores).toEqual([["7", "9"]]);
  });

  it("si la consulta falla, pide al modelo que la corrija", async () => {
    ejecutarSQL.mockRejectedValueOnce(new Error("column totl does not exist"));
    respuestaModelo("x");

    const r = await responder([{ rol: "usuario", texto: "?" }]);

    expect(planificar).toHaveBeenCalledTimes(2);
    expect(planificar.mock.calls[1][2]).toEqual({
      sql,
      error: "column totl does not exist",
    });
    expect(r.modo).toBe("sql");
  });

  it("si falla dos veces, usa la búsqueda semántica", async () => {
    ejecutarSQL.mockRejectedValue(new Error("boom"));
    query.mockResolvedValue({ rows: [fila("7", "Total: 13,55 EUR")] });
    respuestaModelo("13,55 EUR [1]");

    const r = await responder([{ rol: "usuario", texto: "?" }]);

    expect(planificar).toHaveBeenCalledTimes(2);
    expect(r.modo).toBe("semantica");
    expect(embeddings).toHaveBeenCalled();
  });

  it("si falla la consulta de documentos, responde sin fuentes", async () => {
    ejecutarSQL.mockImplementation(async (q: string) => {
      if (q === sqlDocumentos) throw new Error("boom");
      return resultado;
    });
    respuestaModelo("26,10 EUR");

    const r = await responder([{ rol: "usuario", texto: "?" }]);

    expect(r.modo).toBe("sql");
    expect(r.fuentes).toEqual([]);
    expect(cuerpoEnviado().messages.at(-1).content).toContain("no cites ninguno");
  });

  it("sin usuario de solo lectura no intenta SQL", async () => {
    urlLectura.mockReturnValue(null);
    query.mockResolvedValue({ rows: [fila("7", "Total: 13,55 EUR")] });
    respuestaModelo("13,55 EUR [1]");

    const r = await responder([{ rol: "usuario", texto: "¿Cuánto he gastado?" }]);

    expect(planificar).not.toHaveBeenCalled();
    expect(ejecutarSQL).not.toHaveBeenCalled();
    expect(r.modo).toBe("semantica");
  });

  it("un error del modelo al redactar no vuelve a generar la consulta", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: "Sin saldo" } }),
    } as Response);

    await expect(responder([{ rol: "usuario", texto: "?" }])).rejects.toThrow("Sin saldo");
    expect(planificar).toHaveBeenCalledTimes(1);
  });
});
