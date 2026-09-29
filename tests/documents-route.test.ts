import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));

const { GET } = await import("@/app/api/documents/route");

const fila = {
  id: "7",
  filename: "factura.png",
  tipo: "factura",
  titulo: "F-2026-0142",
  detalle: "Papeleria Lopez S.L.",
  fecha: "2026-09-15",
  chunks: 3,
  confirmed_at: "2026-09-22 20:30",
  importe: 13.55,
  moneda: "EUR",
};

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [fila] });
});

describe("lista de documentos guardados", () => {
  it("devuelve los documentos", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ documentos: [fila] });
  });

  it("solo incluye los confirmados y los más recientes primero", async () => {
    await GET();

    const [sql] = query.mock.calls[0];
    expect(sql).toContain("WHERE d.confirmed_at IS NOT NULL");
    expect(sql).toContain("ORDER BY d.confirmed_at DESC");
  });

  it("cuenta los fragmentos indexados de cada documento", async () => {
    await GET();

    expect(query.mock.calls[0][0]).toContain("FROM document_chunks");
  });

  it("devuelve una lista vacía si no hay nada guardado", async () => {
    query.mockResolvedValue({ rows: [] });

    expect(await (await GET()).json()).toEqual({ documentos: [] });
  });
});
