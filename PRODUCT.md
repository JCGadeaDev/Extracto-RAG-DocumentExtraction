# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Proyecto personal y pieza de portfolio. Quien lo usa es su autor y quien lo evalúa
(reclutadores, clientes potenciales, otros desarrolladores) como demostración técnica de
extracción de documentos con IA y RAG. El trabajo que se hace en la app es real: subir una
factura, recibo o contrato, revisar lo extraído, archivarlo y preguntar sobre lo archivado.

## Product Purpose

Convertir documentos (imágenes y PDF, incluidos escaneados) en datos estructurados y
consultables. Un modelo con visión clasifica el documento y extrae sus datos; una persona
los revisa junto al original y los confirma; lo confirmado pasa a tablas relacionales y a
embeddings, y un chat responde preguntas sobre todo lo archivado. El éxito es que cada paso
se entienda sin explicación y que cualquier cifra se pueda comprobar hasta su origen.

## Positioning

- **Revisión humana antes de guardar:** nada entra en la base de datos sin que alguien vea
  el documento al lado de los datos. La validación marca en rojo lo que no cuadra (fechas,
  campos obligatorios, moneda, subtotal + impuestos = total) y bloquea el guardado.
- **Preguntar en lenguaje natural:** el chat responde sobre los documentos propios y cita
  siempre el documento de origen de cada dato.
- **Precisión y trazabilidad:** cada respuesta enseña su fuente: fragmento usado, similitud,
  SQL ejecutado y su resultado, y enlace al archivo original.
- **Rapidez:** subir, extraer y archivar en segundos, sin teclear datos a mano.

## Operating Context

Flujo en una sola pantalla: subir archivo (arrastrar o elegir) → Analizar → revisar y
corregir en campos editables o en JSON, con el documento visible al lado → Confirmar y
guardar → lista de documentos guardados → chat de preguntas. Acceso protegido con usuario
y contraseña (página /login). Se usa en escritorio y a menudo desde el móvil, por ejemplo
fotografiando un ticket en el momento.

## Capabilities and Constraints

- Tipos de documento: factura, recibo, contrato y "otro". Formatos: PNG, JPG, WEBP, GIF y
  PDF (hasta 10 páginas), máx. 20 MB.
- Estados de un documento: subido → analizado (con o sin errores) → confirmado. Un
  documento con errores no se puede confirmar.
- Chat en dos modos: búsqueda semántica (embeddings) y, para cálculos y totales, SQL
  generado sobre las tablas. En el despliegue actual (seenode) solo está disponible el modo
  semántico, porque el servidor no permite crear el usuario de solo lectura.
- Stack existente: Next.js 16 (App Router), React 19, Tailwind CSS 4, PostgreSQL con
  pgvector, OpenRouter (DeepSeek para visión y chat, bge-m3 para embeddings).
- La interfaz está en español.
- Los tiempos de espera son reales (análisis con IA de varios segundos) y la interfaz debe
  comunicarlos.

## Brand Commitments

Solo el nombre, **Extracto**. No hay logo, colores ni tipografía fijados.

Preferencia fijada por el usuario: el estándar de la categoría, sin excentricidades,
ejecutado con oficio. El listón de acabado es **Stripe Dashboard** (datos financieros
legibles, tablas limpias, jerarquía clara, confianza).

## Evidence on Hand

Documentos de prueba reales usados en desarrollo: una factura de papelería (F-2026-0142) y
una factura de vuelo en PDF (DWAM-57099049). No hay testimonios, clientes, métricas de uso
ni cifras de rendimiento; no deben inventarse.

## Product Principles

1. **La persona decide:** la IA propone y la persona confirma; la interfaz nunca oculta lo
   que se va a guardar.
2. **Todo dato tiene origen:** cualquier cifra lleva a su documento, fragmento o consulta.
3. **Los errores se ven y se entienden:** qué falla, dónde y cómo corregirlo.
4. **Sin fricción en el camino principal:** subir, revisar y guardar debe ser inmediato
   también desde el móvil.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste suficiente en ambos temas, todo operable con teclado y con foco
visible, estados y errores anunciados a lectores de pantalla (no solo por color), y
objetivos táctiles cómodos en móvil.
