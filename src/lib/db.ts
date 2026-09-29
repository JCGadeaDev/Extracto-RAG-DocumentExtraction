import { Pool, types } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  pgPoolLectura?: Pool;
};

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

const DATE_OID = 1082;

/**
 * Conexión con el usuario `extracto_lector` (ver db/init.sql), que solo puede
 * leer las tablas de datos. La usan las consultas SQL que genera el chat.
 */
export function poolLectura(): Pool {
  if (globalForPg.pgPoolLectura) return globalForPg.pgPoolLectura;

  const connectionString = process.env.DATABASE_URL_LECTURA;
  if (!connectionString) throw new Error("Falta DATABASE_URL_LECTURA");

  globalForPg.pgPoolLectura = new Pool({
    connectionString,
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
