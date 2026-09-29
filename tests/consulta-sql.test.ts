import { beforeEach, describe, expect, it, vi } from "vitest";

const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));
vi.mock("@/lib/db", () => ({ poolLectura: () => ({ connect }) }));

const { ejecutarSQL, planificar, validarSQL, SqlNoPermitido } = await import(
  "@/lib/consulta-sql"
);

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
});

describe("validarSQL", () => {
  it("acepta SELECT y WITH, y quita el punto y coma final", () => {
    expect(validarSQL("SELECT sum(total) FROM facturas;")).toBe(
      "SELECT sum(total) FROM facturas",
    );
    expect(validarSQL("with t as (select 1) select * from t")).toBeTruthy();
  });

  it.each([
    ["DELETE FROM facturas", "Solo se permiten consultas SELECT"],
    ["SELECT 1; DROP TABLE facturas", "Solo se permite una sentencia"],
    ["SELECT 1 -- comentario", "No se permiten comentarios"],
    ["SELECT 1 /* x */", "No se permiten comentarios"],
    ["SELECT pg_sleep(10)", "pg_sleep"],
    ["SELECT pg_read_file('/etc/passwd')", "pg_read_file"],
    ["SELECT set_config('role', 'extracto', true)", "set_config"],
    ["SELECT query_to_xml('select 1', true, true, '')", "query_to_xml"],
    ["SELECT * FROM dblink('x', 'y')", "dblink"],
    ["WITH x AS (DELETE FROM facturas RETURNING *) SELECT * FROM x", "DELETE"],
  ])("rechaza %s", (sql, motivo) => {
    expect(() => validarSQL(sql)).toThrow(SqlNoPermitido);
    expect(() => validarSQL(sql)).toThrow(motivo);
  });

  it("no se confunde con palabras dentro de cadenas", () => {
    expect(() =>
      validarSQL("SELECT * FROM conceptos WHERE descripcion ILIKE '%reset; delete%'"),
    ).not.toThrow();
  });
});

describe("ejecutarSQL", () => {
  beforeEach(() => {
    clientQuery.mockImplementation(async (q: unknown) =>
      typeof q === "object"
        ? { fields: [{ name: "total" }], rows: [{ total: "26.10" }] }
        : {},
    );
  });

  it("ejecuta en una transacción de solo lectura con límite de tiempo y la deshace", async () => {
    const r = await ejecutarSQL("SELECT sum(total) AS total FROM facturas");

    expect(r).toEqual({ columnas: ["total"], filas: [{ total: "26.10" }], truncado: false });
    const llamadas = clientQuery.mock.calls.map(([q]) => q);
    expect(llamadas[0]).toBe("BEGIN TRANSACTION READ ONLY");
    expect(llamadas[1]).toContain("statement_timeout");
    expect(llamadas[2]).toEqual({
      text: "SELECT sum(total) AS total FROM facturas",
      queryMode: "extended",
    });
    expect(llamadas.at(-1)).toBe("ROLLBACK");
    expect(release).toHaveBeenCalled();
  });

  it("no ejecuta nada si la consulta no es válida", async () => {
    await expect(ejecutarSQL("DROP TABLE facturas")).rejects.toThrow(SqlNoPermitido);
    expect(connect).not.toHaveBeenCalled();
  });

  it("deshace y libera la conexión aunque la consulta falle", async () => {
    clientQuery.mockImplementation(async (q: unknown) => {
      if (typeof q === "object") throw new Error("column x does not exist");
      return {};
    });

    await expect(ejecutarSQL("SELECT x FROM facturas")).rejects.toThrow("does not exist");
    expect(clientQuery.mock.calls.at(-1)![0]).toBe("ROLLBACK");
    expect(release).toHaveBeenCalled();
  });

  it("recorta resultados muy largos", async () => {
    clientQuery.mockImplementation(async (q: unknown) =>
      typeof q === "object"
        ? { fields: [{ name: "n" }], rows: Array.from({ length: 250 }, (_, n) => ({ n })) }
        : {},
    );

    const r = await ejecutarSQL("SELECT n FROM x");
    expect(r.filas).toHaveLength(200);
    expect(r.truncado).toBe(true);
  });
});

describe("planificar", () => {
  it("devuelve la consulta propuesta por el modelo", async () => {
    respuestaModelo(
      '```json\n{"modo":"sql","sql":"SELECT count(*) FROM facturas","sql_documentos":"SELECT document_id FROM facturas"}\n```',
    );

    expect(await planificar([], "¿Cuántas facturas tengo?")).toEqual({
      modo: "sql",
      sql: "SELECT count(*) FROM facturas",
      sql_documentos: "SELECT document_id FROM facturas",
    });
  });

  it("pide JSON e incluye el esquema de las tablas", async () => {
    respuestaModelo('{"modo":"semantica"}');

    await planificar([], "¿Qué dice la cláusula 3?");

    const body = cuerpoEnviado();
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("facturas(document_id");
    expect(body.messages.at(-1).content).toBe("Pregunta: ¿Qué dice la cláusula 3?");
  });

  it("incluye el error anterior para que lo corrija", async () => {
    respuestaModelo('{"modo":"semantica"}');

    await planificar([], "?", { sql: "SELECT totl FROM facturas", error: "no existe" });

    const ultimo = cuerpoEnviado().messages.at(-1).content;
    expect(ultimo).toContain("SELECT totl FROM facturas");
    expect(ultimo).toContain("Error: no existe");
  });

  it("si la respuesta no es un plan válido, usa la búsqueda semántica", async () => {
    respuestaModelo("no sé");
    expect(await planificar([], "?")).toEqual({ modo: "semantica" });

    respuestaModelo('{"modo":"sql"}');
    expect(await planificar([], "?")).toEqual({ modo: "semantica" });
  });
});
