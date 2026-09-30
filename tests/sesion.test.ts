import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DURACION_SESION_S,
  crearSesion,
  credencialesValidas,
  destinoSeguro,
  sesionValida,
} from "@/lib/sesion";

beforeEach(() => {
  process.env.AUTH_PASSWORD = "secreto";
});

afterEach(() => {
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASSWORD;
});

describe("credencialesValidas", () => {
  it("usa admin como usuario por defecto", () => {
    expect(credencialesValidas("admin", "secreto")).toBe(true);
    expect(credencialesValidas("admin", "secreto1")).toBe(false);
  });

  it("respeta AUTH_USER", () => {
    process.env.AUTH_USER = "juan";
    expect(credencialesValidas("juan", "secreto")).toBe(true);
    expect(credencialesValidas("admin", "secreto")).toBe(false);
  });

  it("sin AUTH_PASSWORD nada es válido", () => {
    delete process.env.AUTH_PASSWORD;
    expect(credencialesValidas("admin", "")).toBe(false);
  });
});

describe("sesiones", () => {
  it("una sesión recién creada es válida", () => {
    expect(sesionValida(crearSesion())).toBe(true);
  });

  it("caduca", () => {
    const ahora = Date.now();
    const sesion = crearSesion(ahora);

    expect(sesionValida(sesion, ahora + (DURACION_SESION_S - 60) * 1000)).toBe(true);
    expect(sesionValida(sesion, ahora + (DURACION_SESION_S + 60) * 1000)).toBe(false);
  });

  it("no se puede alargar cambiando la caducidad", () => {
    const [caducidad, firma] = crearSesion().split(".");
    expect(sesionValida(`${Number(caducidad) + 86400}.${firma}`)).toBe(false);
  });

  it("cambiar la contraseña cierra las sesiones abiertas", () => {
    const sesion = crearSesion();
    process.env.AUTH_PASSWORD = "nueva";
    expect(sesionValida(sesion)).toBe(false);
  });

  it.each([undefined, "", "abc", "123", "x.y"])("rechaza %s", (valor) => {
    expect(sesionValida(valor)).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it.each([
    ["/documentos", "/documentos"],
    ["/a?b=1", "/a?b=1"],
    ["//evil.com", "/"],
    ["https://evil.com", "/"],
    ["/\\evil.com", "/"],
    [null, "/"],
  ])("%s → %s", (entrada, salida) => {
    expect(destinoSeguro(entrada)).toBe(salida);
  });
});
