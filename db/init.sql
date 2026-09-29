CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  filename    TEXT        NOT NULL,
  mime_type   TEXT        NOT NULL,
  size_bytes  INTEGER     NOT NULL,
  content     BYTEA       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resultado de la clasificación y extracción con el LLM
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type     TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction   JSONB;
-- Texto transcrito por el modelo, origen de los embeddings
ALTER TABLE documents ADD COLUMN IF NOT EXISTS texto        TEXT;
-- Se rellena al confirmar los datos revisados
ALTER TABLE documents ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- La columna antigua guardaba un único embedding por documento; ahora se
-- guardan por fragmento en document_chunks.
ALTER TABLE documents DROP COLUMN IF EXISTS embedding;

-- ---------------------------------------------------------------- datos

CREATE TABLE IF NOT EXISTS facturas (
  document_id        BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  numero             TEXT NOT NULL,
  fecha_emision      DATE NOT NULL,
  fecha_vencimiento  DATE,
  emisor_nombre      TEXT NOT NULL,
  emisor_id_fiscal   TEXT,
  emisor_direccion   TEXT,
  receptor_nombre    TEXT NOT NULL,
  receptor_id_fiscal TEXT,
  receptor_direccion TEXT,
  subtotal           NUMERIC(14, 2),
  total              NUMERIC(14, 2) NOT NULL,
  moneda             CHAR(3) NOT NULL,
  forma_pago         TEXT
);

CREATE TABLE IF NOT EXISTS recibos (
  document_id        BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  numero             TEXT,
  fecha              DATE NOT NULL,
  comercio_nombre    TEXT NOT NULL,
  comercio_id_fiscal TEXT,
  comercio_direccion TEXT,
  subtotal           NUMERIC(14, 2),
  total              NUMERIC(14, 2) NOT NULL,
  moneda             CHAR(3) NOT NULL,
  metodo_pago        TEXT
);

CREATE TABLE IF NOT EXISTS contratos (
  document_id      BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  tipo_contrato    TEXT,
  fecha_firma      DATE NOT NULL,
  fecha_inicio     DATE,
  fecha_fin        DATE,
  objeto           TEXT NOT NULL,
  importe          NUMERIC(14, 2),
  moneda           CHAR(3),
  condiciones_pago TEXT,
  duracion         TEXT,
  jurisdiccion     TEXT
);

-- Líneas de facturas y recibos
CREATE TABLE IF NOT EXISTS conceptos (
  id              BIGSERIAL PRIMARY KEY,
  document_id     BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion        INTEGER NOT NULL,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(14, 3),
  precio_unitario NUMERIC(14, 4),
  importe         NUMERIC(14, 2) NOT NULL,
  UNIQUE (document_id, posicion)
);

CREATE TABLE IF NOT EXISTS impuestos (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL,
  tipo        TEXT,
  tasa        NUMERIC(6, 3),
  importe     NUMERIC(14, 2) NOT NULL,
  UNIQUE (document_id, posicion)
);

-- Partes y cláusulas de los contratos
CREATE TABLE IF NOT EXISTS partes (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL,
  nombre      TEXT NOT NULL,
  rol         TEXT,
  id_fiscal   TEXT,
  direccion   TEXT,
  UNIQUE (document_id, posicion)
);

CREATE TABLE IF NOT EXISTS clausulas (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL,
  texto       TEXT NOT NULL,
  UNIQUE (document_id, posicion)
);

-- ----------------------------------------------------------- embeddings

-- 1024 dimensiones: las que devuelve baai/bge-m3 (ver src/lib/embeddings.ts)
CREATE TABLE IF NOT EXISTS document_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL,
  texto       TEXT NOT NULL,
  embedding   VECTOR(1024) NOT NULL,
  UNIQUE (document_id, posicion)
);

-- Índice para búsqueda por distancia coseno
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------ usuario lector

-- Lo usan las consultas SQL que genera el chat (src/lib/consulta-sql.ts): solo
-- puede leer las tablas de datos, sin el contenido de los archivos ni los
-- embeddings. Cambia la contraseña fuera de desarrollo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'extracto_lector') THEN
    CREATE ROLE extracto_lector LOGIN PASSWORD 'extracto_lector';
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM extracto_lector;
GRANT USAGE ON SCHEMA public TO extracto_lector;
GRANT SELECT ON facturas, recibos, contratos, conceptos, impuestos, partes, clausulas
  TO extracto_lector;
GRANT SELECT (id, filename, doc_type, created_at, confirmed_at) ON documents
  TO extracto_lector;
ALTER ROLE extracto_lector SET statement_timeout = '5s';
ALTER ROLE extracto_lector SET default_transaction_read_only = on;
