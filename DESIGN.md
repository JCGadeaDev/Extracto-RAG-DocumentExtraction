---
name: Extracto
description: Extracción y revisión de documentos con IA, con acabado de panel de control.
colors:
  canvas: "#f6f8fa"
  surface: "#ffffff"
  subtle: "#f1f3f6"
  line: "#e3e7ec"
  line-strong: "#cbd2da"
  ink: "#0f172a"
  ink-2: "#334155"
  muted: "#5b6472"
  accent: "#4f46e5"
  accent-hover: "#4338ca"
  accent-soft: "#eef0ff"
  accent-ink: "#3730a3"
  on-accent: "#ffffff"
  ok: "#0f7b4a"
  ok-soft: "#e8f6ee"
  warn: "#8a5300"
  warn-soft: "#fff4e0"
  bad: "#c42b27"
  bad-soft: "#fdecec"
  canvas-dark: "#0b0d12"
  surface-dark: "#12151c"
  subtle-dark: "#181c24"
  line-dark: "#262b35"
  line-strong-dark: "#363c48"
  ink-dark: "#e7eaf0"
  ink-2-dark: "#c3c9d4"
  muted-dark: "#9aa3b2"
  accent-dark: "#8b85ff"
  accent-hover-dark: "#a29dff"
  accent-soft-dark: "#1e1d3a"
  accent-ink-dark: "#c7c4ff"
  on-accent-dark: "#0b0d12"
  ok-dark: "#3dd68c"
  ok-soft-dark: "#0f2a1d"
  warn-dark: "#f5b64f"
  warn-soft-dark: "#2e2210"
  bad-dark: "#ff7a73"
  bad-soft-dark: "#3a1618"
typography:
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.025em"
    fontFeature: "\"cv11\", \"ss01\""
  headline-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body-lg:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  numeral:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    fontFeature: "\"tnum\""
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.subtle}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  input-error:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.ink}"
  badge-neutral:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-error:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  alert-error:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  nav-item:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    padding: "0 10px"
    height: "56px"
  nav-item-active:
    textColor: "{colors.ink}"
  citation-chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
    height: "20px"
---

# Design System: Extracto

## Overview

**Creative North Star: "La mesa de revisión"**

Extracto es una herramienta de trabajo, no un escaparate. El sistema toma el estándar de la categoría (panel de control al nivel de Stripe Dashboard) y lo aplica con disciplina: lienzo gris frío, superficies blancas delimitadas por bordes de 1px, un único acento índigo que marca acción y foco, y color de estado reservado para decir algo. La pieza que define el mundo es la revisión lado a lado: el documento original en un panel y el formulario verificable en el otro, con el progreso del análisis siempre a la vista.

La densidad es de dashboard: texto base de 14px, controles de 36px, tablas con filas de 12px de relleno vertical. La jerarquía sale del peso (400/500/600) y del color de tinta (ink, ink-2, muted), no de tamaños grandes; el titular más grande mide 24px. Las cifras (importes, fechas, contadores) se alinean siempre en columna con numerales tabulares.

Hay dos esquemas y ambos son deliberados. El claro es el de referencia. El oscuro sigue la preferencia del sistema operativo (`prefers-color-scheme`), pensado para el uso en portátil o móvil por la tarde y de noche: lienzo casi negro azulado, superficie un punto más clara, y un reflejo exacto de cada rol del claro (acento, pares suaves de ok/aviso/error, sombras). No hay conmutador manual; el sistema operativo manda.

**Key Characteristics:**
- Neutros fríos con un solo acento índigo; verde, ámbar y rojo solo para estado.
- Bordes de 1px como estructura principal; sombras mínimas.
- Radios pequeños (4–8px), píldora solo para insignias.
- Geist para toda la interfaz, Geist Mono solo para JSON, SQL e identificadores.
- Numerales tabulares en todo dato numérico.
- Esquema oscuro que refleja rol por rol al claro, activado por el sistema.

## Colors

Una paleta de neutros pizarra fríos con un único acento índigo y tres colores de estado en pares tinta/fondo suave.

### Primary
- **Índigo de acción** (`accent`): botón primario, pestaña de navegación activa (subrayado de 2px), anillo de foco, cursor de texto, barra de progreso, icono de la zona de subida, marca. En oscuro se aclara a un lavanda (`accent-dark`) para mantener contraste sobre el lienzo negro.
- **Índigo profundo** (`accent-hover`): estado hover del botón primario.
- **Velo índigo** (`accent-soft`) con **tinta índigo** (`accent-ink`): fondos de elementos seleccionados o informativos del acento: insignia de acento, chips de cita en las respuestas, burbuja del usuario en el chat, zona de subida al arrastrar.
- **Texto sobre acento** (`on-accent`): blanco en claro; en oscuro el texto sobre el acento es el propio lienzo (`on-accent-dark`), porque el lavanda es claro.

### Neutral
- **Lienzo** (`canvas`): fondo de página. Nunca se usa para contenedores.
- **Superficie** (`surface`): paneles, tabla, tarjetas, campos, barra superior (al 80–90% con desenfoque).
- **Sutil** (`subtle`): cabeceras de tabla y de panel, hover de filas y botones fantasma y secundarios, fondo del visor de documento, bloques de código.
- **Línea** (`line`): bordes de paneles y divisores de filas. **Línea fuerte** (`line-strong`): bordes de campos y botones secundarios, conectores entre pasos, barras de desplazamiento.
- **Tinta** (`ink`): títulos y texto principal. **Tinta 2** (`ink-2`): etiquetas de campo, texto secundario de peso, código. **Apagado** (`muted`): descripciones, metadatos, placeholder, pestañas inactivas.

### Estado
- **Verde conforme** (`ok` / `ok-soft`), **ámbar de aviso** (`warn` / `warn-soft`), **rojo de error** (`bad` / `bad-soft`): siempre en par, tinta sobre fondo suave con borde o anillo del mismo tono al 20–25%. Los campos con error llevan borde `bad` y fondo `bad-soft` al 40%.

### Named Rules
**The One Accent Rule.** El índigo es el único color de marca. Se usa para acción, foco, selección y progreso; nunca como decoración ni como fondo de área.

**The Status Needs Words Rule.** Verde, ámbar y rojo solo comunican estado y siempre van acompañados de texto y, en avisos y pasos, de icono. Nunca el color solo.

**The Mirrored Dark Rule.** Todo rol del esquema claro existe en el oscuro con el mismo nombre. Un componente nuevo se escribe una vez contra los roles; si necesita un valor que solo existe en un esquema, falta un token.

## Typography

**Display Font:** no hay; la interfaz no usa tipografía de exhibición.
**Body Font:** Geist (con system-ui, sans-serif), con las alternativas `cv11` y `ss01` activadas.
**Label/Mono Font:** Geist Mono, solo para JSON, SQL e identificadores.

**Character:** Una sola familia neutra y técnica, trabajada con peso y color en lugar de tamaño. Se lee como un instrumento, no como una revista.

### Hierarchy
- **Headline** (600, 24px, 32px, -0.025em): título de página (Revisar un documento, Documentos, Preguntar).
- **Headline sm** (600, 20px, 28px, -0.025em): título de la pantalla de acceso.
- **Title** (600, 16px, 24px): nombre del archivo en revisión, llamada de la zona de subida.
- **Body lg** (400, 15px, 1.625): prosa de las respuestas del chat y texto dentro de campos de acceso; marca en la barra.
- **Body** (400, 14px, 20px): texto base de toda la aplicación, filas de tabla, botones md.
- **Label** (500, 13px): etiquetas de acceso, pasos del progreso, leyendas de grupo, botones sm.
- **Caption** (500 o 400, 12px, 16px): etiquetas de campo del editor, cabeceras de tabla, insignias, metadatos y errores de campo.
- **Mono** (400, 12px): bloques de JSON y SQL sobre fondo sutil.

### Named Rules
**The Tabular Figures Rule.** Importes, fechas, contadores y números de fila usan numerales tabulares. Un número que no se alinea en columna es un defecto.

**The Weight Not Size Rule.** La jerarquía se construye con 400/500/600 y con ink / ink-2 / muted. Nada por encima de 24px; nada en mayúsculas espaciadas.

## Layout

Contenedor centrado de 1400px máximo con márgenes laterales de 16px (24px desde 640px). La barra superior es fija, de 56px, con marca, tres secciones y Salir. El contenido principal lleva 24px de relleno vertical (32px desde 640px).

La revisión es una rejilla de dos columnas a partir de 1024px (`1.1fr` para el original, `1fr` para los datos, 16px de separación); el visor queda fijo bajo la barra mientras el formulario se desplaza, y la barra de acción (Confirmar y guardar) se pega al fondo del panel. Por debajo de 1024px las dos columnas se convierten en pestañas Documento/Datos dentro de un control segmentado. Las páginas de lectura (subida, chat) se estrechan a 768px.

El ritmo sigue la escala de 4px: 4/8/12 dentro de componentes, 16/20/24 entre bloques y en rellenos de panel. Los campos del editor se disponen en dos columnas desde 640px (16px entre columnas, 12px entre filas). En móvil la tabla oculta columnas secundarias en lugar de desplazarse en horizontal.

## Elevation & Depth

Sistema plano con bordes: la profundidad la dan el borde de 1px y el salto de tono lienzo → superficie → sutil. Las sombras son dos, muy suaves, y siempre acompañan a un borde; en oscuro se endurecen para seguir siendo visibles sobre el negro.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px rgb(15 23 42 / 0.06)`; oscuro `0 1px 2px rgb(0 0 0 / 0.4)`): paneles, campos, botones primario y secundario.
- **Elevado** (`box-shadow: 0 4px 12px -2px rgb(15 23 42 / 0.1), 0 2px 4px -2px rgb(15 23 42 / 0.06)`; oscuro `0 6px 16px -4px rgb(0 0 0 / 0.55), 0 2px 4px -2px rgb(0 0 0 / 0.4)`): lo que flota sobre el contenido: formulario de acceso y compositor del chat.

### Named Rules
**The Border First Rule.** Un contenedor se define por su borde de 1px; la sombra solo lo asienta. Sin borde no hay sombra, y no hay sombras desplazadas ni de color.

## Shapes

Esquinas pequeñas y constantes: 6px en controles (botones, campos, control segmentado), 8px en paneles, avisos y compositor, 4px en chips de cita y bloques de código dentro de paneles. La píldora completa es exclusiva de insignias, contadores y marcadores circulares de pasos. La zona de subida es la única pieza con 12px y borde discontinuo de 1.5px; el discontinuo también marca el paso pendiente. Las burbujas del usuario en el chat tienen la esquina inferior derecha reducida (2px) para indicar el origen.

## Components

### Buttons
Compactos y seguros, con respuesta táctil mínima.
- **Shape:** esquinas suaves (6px); iconos a 16px con 8px de separación.
- **Primary:** fondo índigo, texto sobre acento, sombra de reposo; 36px de alto y 14px de relleno lateral (32px y 10px en tamaño sm, texto 13px). En acceso ocupa todo el ancho a 40px.
- **Hover / Focus:** hover a índigo profundo; al pulsar baja 1px; foco con contorno índigo de 2px separado 2px. Transición de 150ms en fondo, color y desplazamiento. Deshabilitado: índigo al 45% y cursor bloqueado.
- **Secondary:** superficie con borde línea fuerte y sombra de reposo; hover a sutil.
- **Ghost:** sin fondo, texto tinta 2; hover a sutil con texto tinta. Se usa para Salir y acciones terciarias.
- Los enlaces que actúan como botón usan exactamente las mismas clases.

### Chips
- **Insignia:** píldora con fondo suave del tono, texto del tono y anillo interior de 1px al 20–25%; 12px, peso 500, icono de 14px opcional. Tonos: neutro, acento, ok, aviso, error.
- **Chip de cita:** número de fuente en el chat, 20px de alto, esquina de 4px, velo índigo con tinta índigo y numerales tabulares; al pasar el cursor se invierte a índigo lleno.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** superficie; cabeceras internas de 40px con texto caption apagado y divisor de línea; el visor usa fondo sutil.
- **Shadow Strategy:** reposo; elevado solo para lo que flota (ver Elevation & Depth).
- **Border:** 1px línea.
- **Internal Padding:** 20px (24px en pantallas anchas), 16–20px en la barra de acción inferior.

### Inputs / Fields
- **Style:** 36px de alto (40px en acceso), superficie, borde 1px línea fuerte, esquina de 6px, sombra de reposo; hover oscurece el borde a apagado.
- **Focus:** borde índigo más anillo de 3px índigo al 20%. El compositor del chat aplica el mismo tratamiento a todo su contenedor.
- **Error:** borde rojo, fondo rojo suave al 40%, mensaje de 12px en rojo con icono debajo, enlazado por `aria-describedby`; el anillo de foco pasa a rojo.

### Navigation
- Tres secciones (Revisar, Documentos, Preguntar) como pestañas a toda la altura de la barra de 56px, texto 14px peso 500 con icono de 16px. Inactiva: apagado, sin subrayado; hover: subrayado de 2px en línea fuerte y texto tinta; activa: subrayado índigo de 2px y texto tinta, con `aria-current="page"`. En móvil se ocultan los iconos y el nombre de la marca; queda el símbolo.

### Avisos
Mensaje en línea con icono de 16px, 8px de esquina, borde del tono al 25% sobre su fondo suave y acción opcional a la derecha. Info usa sutil con borde línea. Los errores se anuncian como `alert`, el resto como `status`.

### Progreso del análisis
Pasos Subido → Analizado → Guardado en línea, 13px peso 500, unidos por conectores de 1px × 20px. Hecho: check verde; en curso: indicador giratorio índigo; pendiente: círculo discontinuo; error: icono y texto rojos. Mientras analiza, una barra indeterminada índigo de 1.4s (`cubic-bezier(0.16, 1, 0.3, 1)`) y campos esqueleto que laten a 1.6s; ambas animaciones se detienen con `prefers-reduced-motion`.

### Tabla de documentos
Superficie con borde y esquina de 8px; cabecera sobre sutil al 60% con texto caption apagado; celdas de 16px × 12px; filas divididas por línea con hover a sutil al 50%; importes alineados a la derecha en tabulares.

## Do's and Don'ts

### Do:
- **Do** escribir cada componente contra los roles (`canvas`, `surface`, `line`, `ink`, `accent`, `ok-soft`…) para que el esquema oscuro funcione sin trabajo extra.
- **Do** usar el índigo solo para la acción principal, el foco, la selección y el progreso.
- **Do** acompañar cada color de estado con texto y, en avisos y pasos, con icono.
- **Do** aplicar numerales tabulares a importes, fechas y contadores, y alinear importes a la derecha.
- **Do** definir contenedores con borde de 1px y esquina de 8px; controles con esquina de 6px.
- **Do** mostrar el trabajo del modelo: pasos visibles, errores enlazados a su campo, fuentes citadas.
- **Do** detener toda animación continua con `prefers-reduced-motion`.

### Don't:
- **Don't** introducir un segundo color de marca ni degradados; el índigo es la única voz.
- **Don't** usar verde, ámbar o rojo como decoración ni como único portador del significado.
- **Don't** superar 24px en titulares ni usar etiquetas en mayúsculas espaciadas sobre los títulos.
- **Don't** usar sombras desplazadas, de color o sin borde; solo las dos sombras del vocabulario.
- **Don't** usar Geist Mono fuera de JSON, SQL e identificadores.
- **Don't** fijar colores en hexadecimal dentro de un componente cuando existe un rol que lo cubre.
