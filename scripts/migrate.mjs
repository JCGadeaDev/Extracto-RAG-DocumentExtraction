// Aplica db/init.sql y crea el usuario de solo lectura del chat. Se ejecuta al
// arrancar en producción (en Docker Compose lo hace el propio contenedor de
// PostgreSQL). Es idempotente: se puede lanzar en cada despliegue.
//
// Variables: DATABASE_URL (obligatoria), LECTOR_PASSWORD y LECTOR_USER
// (opcional; por defecto "<base de datos>_lector", porque en un servidor
// compartido los nombres de rol son globales).
import { readFileSync } from "node:fs";
import { checkServerIdentity } from "node:tls";
import pg from "pg";

// TLS con CA propia; igual que configuracionSsl() en src/lib/db.ts
function configuracionSsl() {
  const archivo = process.env.DATABASE_CA_FILE;
  if (!archivo) return undefined;
  const nombre = process.env.DATABASE_TLS_SERVERNAME;
  return {
    ca: readFileSync(archivo, "utf8"),
    rejectUnauthorized: true,
    ...(nombre && {
      checkServerIdentity: (_host, cert) => checkServerIdentity(nombre, cert),
    }),
  };
}

// La parte del usuario lector de init.sql usa un nombre y una contraseña fijos,
// pensados para desarrollo; aquí se sustituye por la versión configurable.
const MARCA_LECTOR = "-- ------------------------------------------------------ usuario lector";

const TABLAS_LECTURA = [
  "facturas",
  "recibos",
  "contratos",
  "conceptos",
  "impuestos",
  "partes",
  "clausulas",
];
const COLUMNAS_DOCUMENTS = ["id", "filename", "doc_type", "created_at", "confirmed_at"];

async function crearLector(client, password) {
  const { rows } = await client.query("SELECT current_database() AS db");
  const nombre = process.env.LECTOR_USER || `${rows[0].db}_lector`;
  const rol = client.escapeIdentifier(nombre);

  const existente = await client.query(
    "SELECT pg_has_role(current_user, oid, 'MEMBER') AS propio FROM pg_roles WHERE rolname = $1",
    [nombre],
  );
  const clave = client.escapeLiteral(password);
  if (existente.rows.length === 0) {
    await client.query(`CREATE ROLE ${rol} LOGIN PASSWORD ${clave}`);
  } else if (!existente.rows[0].propio) {
    throw new Error(`El rol ${nombre} ya existe y no pertenece a este usuario`);
  } else {
    await client.query(`ALTER ROLE ${rol} LOGIN PASSWORD ${clave}`);
  }

  await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${rol}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${rol}`);
  await client.query(`GRANT SELECT ON ${TABLAS_LECTURA.join(", ")} TO ${rol}`);
  await client.query(
    `GRANT SELECT (${COLUMNAS_DOCUMENTS.join(", ")}) ON documents TO ${rol}`,
  );
  await client.query(`ALTER ROLE ${rol} SET statement_timeout = '5s'`);
  await client.query(`ALTER ROLE ${rol} SET default_transaction_read_only = on`);
  console.log(`Usuario lector listo: ${nombre}`);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const sql = readFileSync(new URL("../db/init.sql", import.meta.url), "utf8");
const esquema = sql.split(MARCA_LECTOR)[0];

const client = new pg.Client({ connectionString: url, ssl: configuracionSsl() });
await client.connect();
try {
  await client.query(esquema);
  console.log("Esquema aplicado");

  const password = process.env.LECTOR_PASSWORD;
  if (!password) {
    console.warn("Sin LECTOR_PASSWORD: el chat no podrá responder con SQL");
  } else {
    try {
      await crearLector(client, password);
    } catch (err) {
      // Sin permiso para crear roles la app funciona igual; el chat usa
      // entonces solo la búsqueda semántica
      if (err.code !== "42501") throw err;
      console.warn(`No se pudo crear el usuario lector: ${err.message}`);
    }
  }
} finally {
  await client.end();
}
