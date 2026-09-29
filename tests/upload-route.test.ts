import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));

const { POST } = await import("@/app/api/upload/route");

function peticionCon(file: File) {
  const form = new FormData();
  form.append("file", file);
  return new Request("http://test/api/upload", { method: "POST", body: form });
}

function pdf(bytes = 1000) {
  return new File([new Uint8Array(bytes)], "factura.pdf", {
    type: "application/pdf",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [{ id: "42" }] });
});

describe("subida correcta", () => {
  it("guarda un PDF y devuelve su id", async () => {
    const res = await POST(peticionCon(pdf()));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "42" });
  });

  it("guarda nombre, tipo, tamaño y contenido", async () => {
    await POST(peticionCon(pdf(1234)));

    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO documents");
    expect(valores[0]).toBe("factura.pdf");
    expect(valores[1]).toBe("application/pdf");
    expect(valores[2]).toBe(1234);
    expect(valores[3]).toHaveLength(1234);
  });

  it("acepta también imágenes", async () => {
    const png = new File([new Uint8Array(10)], "ticket.png", {
      type: "image/png",
    });
    const res = await POST(peticionCon(png));
    expect(res.status).toBe(201);
  });

  it("no analiza nada al subir: eso es un paso aparte", async () => {
    await POST(peticionCon(pdf()));
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("subida rechazada", () => {
  it("rechaza una petición sin archivo", async () => {
    const res = await POST(
      new Request("http://test/api/upload", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ningún archivo/);
    expect(query).not.toHaveBeenCalled();
  });

  it("rechaza un tipo no permitido", async () => {
    const docx = new File([new Uint8Array(10)], "contrato.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const res = await POST(peticionCon(docx));

    expect(res.status).toBe(415);
    expect((await res.json()).error).toMatch(/imágenes o PDF/);
    expect(query).not.toHaveBeenCalled();
  });

  it("rechaza un archivo de más de 20 MB", async () => {
    const grande = new File([new Uint8Array(21 * 1024 * 1024)], "escaneo.pdf", {
      type: "application/pdf",
    });

    const res = await POST(peticionCon(grande));

    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/20 MB/);
    expect(query).not.toHaveBeenCalled();
  });

  it("acepta justo en el límite de 20 MB", async () => {
    const limite = new File([new Uint8Array(20 * 1024 * 1024)], "escaneo.pdf", {
      type: "application/pdf",
    });

    const res = await POST(peticionCon(limite));
    expect(res.status).toBe(201);
  });
});
