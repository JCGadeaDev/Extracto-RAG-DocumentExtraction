import { readFileSync } from "node:fs";
import { checkServerIdentity, type ConnectionOptions } from "node:tls";
import { Pool, types } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  pgPoolLectura?: Pool;
};

/**
 * TLS verificado contra una CA concreta (DATABASE_CA_FILE), para bases de datos
 * gestionadas con CA propia. DATABASE_TLS_SERVERNAME es el nombre que figura en
 * el certificado cuando el host de conexión es un alias (CNAME) de él. Sin
 * DATABASE_CA_FILE se usa la configuración de siempre (PGSSLMODE o la URL).
 * Duplicado en scripts/migrate.mjs.
 */
export function configuracionSsl(): ConnectionOptions | undefined {
  const archivo = process.env.DATABASE_CA_FILE;
  if (!archivo) return undefined;

  const nombre = process.env.DATABASE_TLS_SERVERNAME;
  return {
    ca: readFileSync(archivo, "utf8"),
    rejectUnauthorized: true,
    ...(nombre && {
      checkServerIdentity: (_host: string, cert) => checkServerIdentity(nombre, cert),
    }),
  };
}

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, ssl: configuracionSsl() });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

const DATE_OID = 1082;

/**
 * DATABASE_URL_LECTURA si está definida; si no, la de DATABASE_URL con el
 * usuario lector que crea scripts/migrate.mjs ("<base de datos>_lector").
 */
export function urlLectura(): string | null {
  if (process.env.DATABASE_URL_LECTURA) return process.env.DATABASE_URL_LECTURA;

  const password = process.env.LECTOR_PASSWORD;
  const base = process.env.DATABASE_URL;
  if (!password || !base) return null;

  const url = new URL(base);
  const baseDeDatos = decodeURIComponent(url.pathname.slice(1));
  url.username = encodeURIComponent(process.env.LECTOR_USER || `${baseDeDatos}_lector`);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Conexión con el usuario `extracto_lector` (ver db/init.sql), que solo puede
 * leer las tablas de datos. La usan las consultas SQL que genera el chat.
 */
export function poolLectura(): Pool {
  if (globalForPg.pgPoolLectura) return globalForPg.pgPoolLectura;

  const connectionString = urlLectura();
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL_LECTURA o LECTOR_PASSWORD");
  }

  globalForPg.pgPoolLectura = new Pool({
    connectionString,
    ssl: configuracionSsl(),
    max: 3,
    // Las fechas se devuelven tal cual ("2026-09-15"), sin convertirlas a Date
    // con la zona horaria del servidor
    types: {
      getTypeParser: ((oid: number, format?: "text" | "binary") =>
        oid === DATE_OID
          ? (valor: string) => valor
          : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
    },
  });
  return globalForPg.pgPoolLectura;
}
