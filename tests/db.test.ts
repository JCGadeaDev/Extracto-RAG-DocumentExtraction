import { afterEach, describe, expect, it } from "vitest";
import { urlLectura } from "@/lib/db";

afterEach(() => {
  delete process.env.DATABASE_URL_LECTURA;
  delete process.env.LECTOR_PASSWORD;
  delete process.env.LECTOR_USER;
  process.env.DATABASE_URL = "postgres://duenio:clave@host:5432/db_abc?sslmode=require";
});

describe("urlLectura", () => {
  it("usa DATABASE_URL_LECTURA si está definida", () => {
    process.env.DATABASE_URL_LECTURA = "postgres://lector:x@h/db";
    expect(urlLectura()).toBe("postgres://lector:x@h/db");
  });

  it("sin LECTOR_PASSWORD no hay conexión de lectura", () => {
    expect(urlLectura()).toBeNull();
  });

  it("deriva la URL con el usuario <base de datos>_lector", () => {
    process.env.DATABASE_URL = "postgres://duenio:clave@host:5432/db_abc?sslmode=require";
    process.env.LECTOR_PASSWORD = "p@ss word";

    expect(urlLectura()).toBe(
      "postgres://db_abc_lector:p%40ss%20word@host:5432/db_abc?sslmode=require",
    );
  });

  it("respeta LECTOR_USER", () => {
    process.env.DATABASE_URL = "postgres://duenio:clave@host:5432/db_abc";
    process.env.LECTOR_PASSWORD = "x";
    process.env.LECTOR_USER = "mi_lector";

    expect(urlLectura()).toBe("postgres://mi_lector:x@host:5432/db_abc");
  });
});
