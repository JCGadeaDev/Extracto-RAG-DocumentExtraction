import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));

const { GET } = await import("@/app/api/documents/[id]/file/route");

function pedir(id: string) {
  return GET(new Request(`http://test/api/documents/${id}/file`), {
    params: Promise.resolve({ id }),
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("archivo original", () => {
  it("devuelve el contenido con su tipo", async () => {
    query.mockResolvedValue({
      rows: [
        {
          filename: "factura ñ.pdf",
          mime_type: "application/pdf",
          content: Buffer.from("%PDF"),
        },
      ],
    });

    const res = await pedir("7");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      "inline; filename*=UTF-8''factura%20%C3%B1.pdf",
    );
    expect(await res.text()).toBe("%PDF");
  });

  it("404 si no existe", async () => {
    query.mockResolvedValue({ rows: [] });
    expect((await pedir("99")).status).toBe(404);
  });

  it("400 con un id no numérico", async () => {
    expect((await pedir("1;DROP")).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
