import { afterEach, describe, expect, it } from "vitest";
import { configuracionSsl, urlLectura } from "@/lib/db";

afterEach(() => {
  delete process.env.DATABASE_URL_LECTURA;
  delete process.env.LECTOR_PASSWORD;
  delete process.env.LECTOR_USER;
  delete process.env.DATABASE_CA_FILE;
  delete process.env.DATABASE_TLS_SERVERNAME;
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

describe("configuracionSsl", () => {
  it("sin DATABASE_CA_FILE deja la configuración por defecto", () => {
    expect(configuracionSsl()).toBeUndefined();
  });

  it("fija la CA y exige un certificado válido", () => {
    process.env.DATABASE_CA_FILE = "db/seenode-ca.pem";

    const ssl = configuracionSsl()!;

    expect(ssl.ca).toContain("BEGIN CERTIFICATE");
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.checkServerIdentity).toBeUndefined();
  });

  it("comprueba la identidad contra DATABASE_TLS_SERVERNAME", () => {
    process.env.DATABASE_CA_FILE = "db/seenode-ca.pem";
    process.env.DATABASE_TLS_SERVERNAME = "real.example.com";

    const comprobar = configuracionSsl()!.checkServerIdentity!;
    const cert = { subject: { CN: "real.example.com" }, subjectaltname: "DNS:real.example.com" };

    expect(comprobar("alias.example.com", cert as never)).toBeUndefined();
    expect(
      comprobar("alias.example.com", { ...cert, subjectaltname: "DNS:otro.com" } as never),
    ).toBeInstanceOf(Error);
  });
});
