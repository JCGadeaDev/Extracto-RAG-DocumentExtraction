import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function pedir(auth?: string) {
  return proxy(
    new NextRequest("http://test/api/documents", {
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

function basic(usuario: string, password: string) {
  return `Basic ${btoa(`${usuario}:${password}`)}`;
}

afterEach(() => {
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASSWORD;
});

describe("protección con contraseña", () => {
  it("sin AUTH_PASSWORD la app queda abierta", () => {
    expect(pedir().status).toBe(200);
  });

  describe("con AUTH_PASSWORD", () => {
    it("pide credenciales si no se envían", () => {
      process.env.AUTH_PASSWORD = "secreto";

      const res = pedir();

      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
    });

    it("deja pasar con el usuario y la contraseña correctos", () => {
      process.env.AUTH_PASSWORD = "secreto:con dos puntos";
      process.env.AUTH_USER = "juan";

      expect(pedir(basic("juan", "secreto:con dos puntos")).status).toBe(200);
    });

    it("usa admin como usuario por defecto", () => {
      process.env.AUTH_PASSWORD = "secreto";

      expect(pedir(basic("admin", "secreto")).status).toBe(200);
    });

    it.each([
      ["contraseña incorrecta", basic("admin", "otra")],
      ["usuario incorrecto", basic("otro", "secreto")],
      ["contraseña más larga", basic("admin", "secreto1")],
      ["cabecera mal formada", "Basic %%%"],
      ["otro esquema", "Bearer secreto"],
    ])("rechaza %s", (_, auth) => {
      process.env.AUTH_PASSWORD = "secreto";

      expect(pedir(auth).status).toBe(401);
    });
  });
});
