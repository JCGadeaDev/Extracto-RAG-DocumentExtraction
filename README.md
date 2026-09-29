# Extracto

Next.js + PostgreSQL (pgvector). Página única para subir imágenes o PDFs y ver su vista previa.
Cada archivo se guarda en la tabla `documents` (ver `db/init.sql`), que incluye una columna
`embedding vector(1536)` preparada para búsquedas semánticas.

Al subir un archivo, se envía vía OpenRouter a DeepSeek (`deepseek/deepseek-v4.1-flash`,
con visión), que lo clasifica como factura, recibo, contrato u otro y extrae sus datos en
JSON. Los PDF se convierten en el servidor a una imagen por página (máx. 10) y el propio
modelo hace el OCR, así que también funcionan los escaneados. El resultado se guarda en las
columnas `doc_type` y `extraction` (JSONB).

En pantalla se ve el documento a la izquierda y los datos a la derecha, en campos editables
o como JSON. Los datos se validan con zod (`src/lib/schemas.ts`): formato de fechas, campos
obligatorios, código de moneda y que `subtotal + impuestos` cuadre con el `total`. Los campos
inválidos salen en rojo y la validación se repite en cuanto se corrigen.

Al pulsar **Confirmar y guardar** (solo posible sin errores, y se revalida en el servidor)
los datos revisados pasan a sus tablas — `facturas`, `recibos`, `contratos`, con `conceptos`,
`impuestos`, `partes` y `clausulas` — y la transcripción del documento se trocea y se guarda
como embeddings de 1024 dimensiones en `document_chunks` (pgvector, índice HNSW coseno,
modelo `baai/bge-m3` vía OpenRouter). Todo ocurre en una transacción, y volver a confirmar
reemplaza lo anterior en vez de duplicarlo. Debajo del formulario hay una lista de los
documentos ya guardados.

Al final de la página hay un chat, **Pregunta a tus documentos**. Cada pregunta se convierte en
embedding y se buscan por similitud coseno los 8 fragmentos más cercanos entre los documentos
confirmados, que se agrupan por documento y se numeran. El modelo responde solo con esa
información y cita cada dato con `[n]`. Debajo de la respuesta aparecen solo los documentos
citados, con el fragmento usado y un enlace al archivo original (`/api/documents/:id/file`). Si
la respuesta no está en los documentos, lo dice y no cita nada. Para las preguntas de
seguimiento ("¿y cuándo vence?") se busca junto con la pregunta anterior.

Las preguntas de **cálculo** (totales, conteos, medias, rankings, filtros por fecha o importe,
gasto por proveedor…) no usan embeddings: el modelo decide primero el camino y, en ese caso,
escribe una consulta SQL sobre las tablas (`src/lib/consulta-sql.ts`). La respuesta usa las
cifras exactas del resultado, cita los documentos que intervienen y permite ver el SQL y la
tabla de resultados. Si la consulta falla, se le pasa el error al modelo para que la corrija
una vez; si vuelve a fallar, se responde con la búsqueda semántica.

Como el SQL lo escribe un modelo, se ejecuta con varias barreras:
- Usuario `extracto_lector` (`DATABASE_URL_LECTURA`), que solo tiene `SELECT` sobre las tablas
  de datos y sobre las columnas de `documents` sin el contenido del archivo.
- Transacción `READ ONLY` que siempre se deshace, con 5 s de tiempo máximo.
- Una sola sentencia (protocolo extendido), solo `SELECT`/`WITH`, sin comentarios, y una lista
  de palabras y funciones prohibidas (`pg_*`, `set_config`, `dblink`, `*_to_xml`…).

Si ya tenías la base de datos creada, aplica el esquema otra vez para crear el usuario lector
(el script es idempotente):

```bash
docker compose exec -T db psql -U extracto -f - < db/init.sql
```

Ejemplo de búsqueda semántica sobre lo indexado:

```sql
SELECT document_id, 1 - (embedding <=> :consulta) AS similitud, texto
  FROM document_chunks ORDER BY embedding <=> :consulta LIMIT 5;
```

## Configuración

Copia `.env.example` a `.env` y pon tu `OPENROUTER_API_KEY`. Docker Compose y `npm run dev`
leen ese archivo.

## Todo con Docker

```bash
docker compose up -d --build
```

App en http://localhost:3001 (cambia el puerto con `APP_PORT=4000 docker compose up -d`).

## Tests

```bash
npm test
```

Cubren la validación de cada tipo de documento, la llamada al modelo (simulada, no gasta
saldo) y las dos rutas de la API. No hace falta base de datos ni clave de OpenRouter.

## Desarrollo local

```bash
docker compose up -d db   # solo la base de datos
npm run dev               # usa DATABASE_URL de .env.local
```

App en http://localhost:3000.
