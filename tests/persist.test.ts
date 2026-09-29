import { beforeEach, describe, expect, it, vi } from "vitest";
import { contratoValido, facturaValida, reciboValido } from "./fixtures";

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));
vi.mock("@/lib/db", () => ({ pool: { connect, query } }));

const embeddings = vi.fn();
vi.mock("@/lib/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/embeddings")>()),
  embeddings,
}));

const { guardarConfirmado } = await import("@/lib/persist");

/** Todas las sentencias enviadas, en orden. */
function sentencias(): string[] {
  return query.mock.calls.map(([sql]) => sql.trim().replace(/\s+/g, " "));
}

function sentenciaCon(fragmento: string) {
  return query.mock.calls.find(([sql]) => sql.includes(fragmento));
}

function sentenciasCon(fragmento: string) {
  return query.mock.calls.filter(([sql]) => sql.includes(fragmento));
}

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
  embeddings.mockImplementation(async (textos: string[]) =>
    textos.map(() => new Array(1024).fill(0.5)),
  );
});

describe("factura", () => {
  it("guarda la cabecera en la tabla facturas", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const [, valores] = sentenciaCon("INSERT INTO facturas")!;
    expect(valores.slice(0, 5)).toEqual([
      "7", "F-2026-0142", "2026-09-15", null, "Papeleria Lopez S.L.",
    ]);
    expect(valores).toContain(13.55);
    expect(valores).toContain("EUR");
  });

  it("guarda una fila por concepto, numeradas en orden", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const conceptos = sentenciasCon("INSERT INTO conceptos");
    expect(conceptos).toHaveLength(2);
    expect(conceptos[0][1].slice(0, 6)).toEqual(["7", 0, "Cuaderno A4", 2, 3.5, 7]);
    expect(conceptos[1][1][1]).toBe(1);
  });

  it("guarda los impuestos", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const [, valores] = sentenciaCon("INSERT INTO impuestos")!;
    expect(valores).toEqual(["7", 0, "IVA", 21, 2.35]);
  });

  it("no toca las tablas de otros tipos", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    expect(sentenciaCon("INSERT INTO recibos")).toBeUndefined();
    expect(sentenciaCon("INSERT INTO contratos")).toBeUndefined();
  });
});

describe("recibo y contrato", () => {
  it("el recibo va a su tabla con sus conceptos", async () => {
    await guardarConfirmado("8", reciboValido, reciboValido.texto);

    const [, valores] = sentenciaCon("INSERT INTO recibos")!;
    expect(valores.slice(0, 4)).toEqual(["8", null, "2026-01-09", "Super Sol"]);
    expect(sentenciasCon("INSERT INTO conceptos")).toHaveLength(1);
  });

  it("el contrato guarda cabecera y partes", async () => {
    await guardarConfirmado("9", contratoValido, contratoValido.texto);

    const [, valores] = sentenciaCon("INSERT INTO contratos")!;
    expect(valores[1]).toBe("CONTRATO DE ARRENDAMIENTO DE LOCAL");
    expect(sentenciasCon("INSERT INTO partes")).toHaveLength(2);
  });

  it("guarda las cláusulas y se salta las vacías", async () => {
    const conClausulas = {
      ...contratoValido,
      datos: {
        ...contratoValido.datos,
        clausulas_clave: ["Duración: 5 años", "   ", "Fianza: dos meses"],
      },
    };

    await guardarConfirmado("9", conClausulas, conClausulas.texto);

    const clausulas = sentenciasCon("INSERT INTO clausulas");
    expect(clausulas).toHaveLength(2);
    expect(clausulas[1][1][2]).toBe("Fianza: dos meses");
  });

  it("un documento 'otro' no crea filas de datos, solo embeddings", async () => {
    const otro = {
      tipo: "otro" as const,
      confianza: 0.3,
      resumen: "Nota suelta",
      texto: "Una nota cualquiera",
      datos: { nota: "algo" },
    };

    await guardarConfirmado("10", otro, otro.texto);

    expect(sentencias().some((s) => s.startsWith("INSERT INTO document_chunks"))).toBe(true);
    expect(sentenciaCon("INSERT INTO facturas")).toBeUndefined();
    expect(sentenciaCon("INSERT INTO recibos")).toBeUndefined();
    expect(sentenciaCon("INSERT INTO contratos")).toBeUndefined();
  });
});

describe("embeddings y transacción", () => {
  it("guarda un fragmento por trozo de texto, con su vector", async () => {
    const resultado = await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const chunks = sentenciasCon("INSERT INTO document_chunks");
    expect(resultado.chunks).toBe(1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0][1][2]).toBe(facturaValida.texto);
    expect(chunks[0][1][3]).toMatch(/^\[0\.5,0\.5/);
  });

  it("trocea los textos largos y pide un embedding por fragmento", async () => {
    const largo = Array.from({ length: 200 }, (_, i) => `Linea ${i}`).join("\n");

    const resultado = await guardarConfirmado("7", facturaValida, largo);

    expect(resultado.chunks).toBeGreaterThan(1);
    expect(embeddings.mock.calls[0][0]).toHaveLength(resultado.chunks);
    expect(sentenciasCon("INSERT INTO document_chunks")).toHaveLength(resultado.chunks);
  });

  it("borra lo anterior para que confirmar dos veces no duplique", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const borrados = sentenciasCon("DELETE FROM").map(([sql]) =>
      sql.match(/DELETE FROM (\w+)/)![1],
    );
    expect(borrados).toContain("facturas");
    expect(borrados).toContain("conceptos");
    expect(borrados).toContain("document_chunks");
  });

  it("marca el documento como confirmado", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    const [sql, valores] = sentenciaCon("UPDATE documents")!;
    expect(sql).toContain("confirmed_at = now()");
    expect(valores).toEqual(["factura", facturaValida, facturaValida.texto, "7"]);
  });

  it("abre y cierra la transacción, y suelta la conexión", async () => {
    await guardarConfirmado("7", facturaValida, facturaValida.texto);

    expect(sentencias()[0]).toBe("BEGIN");
    expect(sentencias().at(-1)).toBe("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  it("deshace la transacción si falla una inserción", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO conceptos")) throw new Error("columna nula");
      return { rows: [] };
    });

    await expect(
      guardarConfirmado("7", facturaValida, facturaValida.texto),
    ).rejects.toThrow("columna nula");

    expect(sentencias()).toContain("ROLLBACK");
    expect(sentencias()).not.toContain("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  it("no abre transacción si fallan los embeddings", async () => {
    embeddings.mockRejectedValue(new Error("Sin saldo"));

    await expect(
      guardarConfirmado("7", facturaValida, facturaValida.texto),
    ).rejects.toThrow("Sin saldo");

    expect(connect).not.toHaveBeenCalled();
  });
});
