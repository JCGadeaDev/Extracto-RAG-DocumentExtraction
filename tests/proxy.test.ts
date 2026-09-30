import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { COOKIE_SESION, crearSesion } from "@/lib/sesion";

function pedir(ruta: string, cabeceras: Record<string, string> = {}) {
  return proxy(new NextRequest(`http://test${ruta}`, { headers: cabeceras }));
}

function basic(usuario: string, password: string) {
  return `Basic ${btoa(`${usuario}:${password}`)}`;
}

afterEach(() => {
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASSWORD;
});

describe("sin AUTH_PASSWORD", () => {
  it("la app queda abierta", () => {
    expect(pedir("/api/documents").status).toBe(200);
  });
});

describe("con AUTH_PASSWORD", () => {
  beforeEach(() => {
    process.env.AUTH_PASSWORD = "secreto";
  });

  it("manda las páginas a /login", () => {
    const res = pedir("/");

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://test/login");
  });

  it("recuerda la página pedida para volver tras entrar", () => {
    const res = pedir("/documentos?x=1");

    expect(res.headers.get("Location")).toBe("http://test/login?next=%2Fdocumentos%3Fx%3D1");
  });

  it("redirige al host y protocolo públicos detrás de un balanceador", () => {
    const res = pedir("/", { "x-forwarded-proto": "https", "x-forwarded-host": "app.example.com" });

    expect(res.headers.get("Location")).toBe("https://app.example.com/login");
  });

  it("responde 401 en la API, sin redirigir", async () => {
    const res = pedir("/api/documents");

    expect(res.status).toBe(401);
    expect((await res.json()).error).toContain("Inicia sesión");
  });

  it("deja ver la página de acceso y su API sin sesión", () => {
    expect(pedir("/login").status).toBe(200);
    expect(pedir("/api/login").status).toBe(200);
  });

  it("deja pasar con una sesión válida", () => {
    const res = pedir("/api/documents", { cookie: `${COOKIE_SESION}=${crearSesion()}` });
    expect(res.status).toBe(200);
  });

  it("rechaza una sesión manipulada", () => {
    const [caducidad] = crearSesion().split(".");
    const res = pedir("/api/documents", {
      cookie: `${COOKIE_SESION}=${Number(caducidad) + 999}.firmafalsa`,
    });
    expect(res.status).toBe(401);
  });

  it("acepta HTTP Basic para scripts", () => {
    expect(pedir("/api/documents", { authorization: basic("admin", "secreto") }).status).toBe(200);
  });

  it.each([
    ["contraseña incorrecta", basic("admin", "otra")],
    ["usuario incorrecto", basic("otro", "secreto")],
    ["cabecera mal formada", "Basic %%%"],
    ["otro esquema", "Bearer secreto"],
  ])("rechaza Basic con %s", (_, auth) => {
    expect(pedir("/api/documents", { authorization: auth }).status).toBe(401);
  });
});
