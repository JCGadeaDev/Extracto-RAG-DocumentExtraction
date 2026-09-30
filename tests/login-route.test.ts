import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "@/app/api/login/route";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

function entrar(campos: Record<string, string>, cabeceras: Record<string, string> = {}) {
  return POST(
    new Request("http://interno:3000/api/login", {
      method: "POST",
      body: new URLSearchParams(campos),
      headers: cabeceras,
    }),
  );
}

function cookieDe(res: Response) {
  return res.headers.get("set-cookie") ?? "";
}

beforeEach(() => {
  process.env.AUTH_PASSWORD = "secreto";
});

afterEach(() => {
  delete process.env.AUTH_PASSWORD;
});

describe("POST /api/login", () => {
  it("abre la sesión y vuelve a la página pedida", async () => {
    const res = await entrar({ usuario: "admin", password: "secreto", next: "/documentos" });

    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("http://interno:3000/documentos");
    const valor = cookieDe(res).match(new RegExp(`${COOKIE_SESION}=([^;]+)`))![1];
    expect(sesionValida(valor)).toBe(true);
    expect(cookieDe(res)).toMatch(/HttpOnly/i);
    expect(cookieDe(res)).toMatch(/SameSite=lax/i);
  });

  it("marca la cookie como Secure detrás de un balanceador HTTPS", async () => {
    const res = await entrar(
      { usuario: "admin", password: "secreto" },
      { "x-forwarded-proto": "https" },
    );
    expect(cookieDe(res)).toMatch(/Secure/i);
  });

  it("redirige al host público, no al interno del contenedor", async () => {
    const res = await entrar(
      { usuario: "admin", password: "secreto" },
      { "x-forwarded-proto": "https", "x-forwarded-host": "app.example.com" },
    );
    expect(res.headers.get("Location")).toBe("https://app.example.com/");
  });

  it("con credenciales incorrectas vuelve a /login con error y sin cookie", async () => {
    const res = await entrar({ usuario: "admin", password: "mal", next: "/documentos" });

    expect(res.headers.get("Location")).toBe(
      "http://interno:3000/login?error=1&next=%2Fdocumentos",
    );
    expect(cookieDe(res)).toBe("");
  });

  it("no redirige a otros sitios", async () => {
    const res = await entrar({ usuario: "admin", password: "secreto", next: "//evil.com" });
    expect(res.headers.get("Location")).toBe("http://interno:3000/");
  });
});

describe("DELETE /api/login", () => {
  it("borra la cookie de sesión", async () => {
    const res = await DELETE();

    expect(res.status).toBe(204);
    expect(cookieDe(res)).toContain(`${COOKIE_SESION}=;`);
  });
});
