---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: ["src/app/page.tsx"]
---

# Surface: app completa (Revisar, Documentos, Preguntar, Acceso)

Modo: Operate. Tarea principal: subir un documento, revisar lo extraído junto al original,
confirmarlo; después consultar el archivo y preguntar sobre él. Uso en escritorio y móvil.
Éxito: la revisión lado a lado es lo que se recuerda; la IA se ve trabajando (estado del
análisis, validación explicada, fuentes trazables). Fracaso: parecer una plantilla o que la
IA sea una caja negra. Canon elegido por el usuario; listón: Stripe Dashboard.

## Direction contract

THESIS: La herramienta estándar de revisión documental hecha con acabado de Stripe: la
pantalla de revisión es un visor de documento y un formulario verificable, uno junto al otro,
con el estado del proceso siempre visible. Rechaza la página única apilada y los paneles
grises intercambiables.

OWN-WORLD: Neutros fríos (lienzo gris muy claro, superficies blancas, bordes de 1px), un
único acento índigo para acción y foco, verde/ámbar/rojo solo para estado y siempre con
texto e icono. Geist para UI, cifras tabulares, Geist Mono solo para JSON/SQL/identificadores.
Radios pequeños (6–8px), sombras mínimas, densidad de dashboard.

STORY: Quien entra ve dónde está (Revisar, Documentos, Preguntar), sube un archivo, ve al
modelo trabajar en pasos, revisa campo a campo con los errores enlazados, guarda, y comprueba
cualquier respuesta hasta su documento de origen.

FIRST VIEWPORT: Barra superior fija con la marca, navegación de tres secciones y Salir. En
Revisar sin archivo: zona de subida amplia centrada con formatos y límite. Con archivo: visor
del documento a la izquierda (≈55%) y panel de revisión a la derecha: cabecera con tipo,
confianza y resumen de validación; pasos Subido → Analizado → Guardado; campos; barra de
acción fija abajo con Confirmar y guardar. En móvil, pestañas Documento/Datos.

FORM: canon (estándar de la categoría), fuera de la lista ordenada; seed af63272c.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
