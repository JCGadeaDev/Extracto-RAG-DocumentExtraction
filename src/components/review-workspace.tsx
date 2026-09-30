"use client";

import { leerJson } from "@/lib/cliente";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Braces,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCw,
  Rows3,
  ScanText,
  Upload,
  X,
} from "lucide-react";
import DataEditor, { caminosNumericos, idCampo, label } from "./data-editor";
import { Aviso, Boton, Insignia, TIPO_LABEL, claseBoton, formatoTamano } from "./ui";
import {
  camposEsperados,
  validarExtraccion,
  type Extraction,
} from "@/lib/schemas";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";

// `id` es el documento ya guardado; permite (re)analizar tras un error
type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "uploaded"; id: string }
  | { kind: "analyzing"; id: string }
  | { kind: "analyzed"; id: string }
  | { kind: "error"; message: string; id?: string };

type Paso = "hecho" | "actual" | "pendiente" | "error";

function nombreCampo(clave: string) {
  const partes = clave.split(".").slice(1);
  return partes
    .map((p) => (/^\d+$/.test(p) ? `línea ${Number(p) + 1}` : label(p)))
    .join(" › ");
}

/** Subido → Analizado → Guardado, con el paso en curso siempre visible. */
function Pasos({ pasos }: { pasos: { label: string; estado: Paso; detalle?: string }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" aria-label="Progreso">
      {pasos.map((p, i) => (
        <li key={p.label} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-5 bg-line-strong" aria-hidden />}
          <span
            className={`flex items-center gap-1.5 font-medium ${
              p.estado === "pendiente"
                ? "text-muted"
                : p.estado === "error"
                  ? "text-bad"
                  : "text-ink"
            }`}
            aria-current={p.estado === "actual" ? "step" : undefined}
          >
            {p.estado === "hecho" && <CircleCheck className="size-4 text-ok" aria-hidden />}
            {p.estado === "actual" && (
              <LoaderCircle className="size-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
            )}
            {p.estado === "pendiente" && (
              <span className="size-4 rounded-full border-[1.5px] border-dashed border-line-strong" aria-hidden />
            )}
            {p.estado === "error" && <CircleAlert className="size-4" aria-hidden />}
            {p.label}
            {p.detalle && <span className="font-normal text-muted">· {p.detalle}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Analizando() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-5 p-5" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <ScanText className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold text-ink">Analizando el documento</p>
          <p className="text-muted">
            El modelo lee el texto, identifica si es una factura, un recibo o un
            contrato y extrae sus campos. Puede tardar unos segundos, algo más
            en PDF de varias páginas.
          </p>
        </div>
        <span className="ml-auto text-xs whitespace-nowrap text-muted tabular">{segundos} s</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-subtle">
        <div className="barra-indeterminada h-full w-2/5 rounded-full bg-accent" />
      </div>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2" aria-hidden>
        {[40, 70, 55, 35, 60, 45].map((w, i) => (
          <div key={i} className="esqueleto flex flex-col gap-2">
            <div className="h-2.5 rounded bg-subtle" style={{ width: `${w}%` }} />
            <div className="h-9 rounded-md bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  // Descarta respuestas de peticiones anteriores si el usuario cambia de archivo
  const requestRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  // Se fija con el resultado del modelo, no con el valor que se está editando
  const [numericos, setNumericos] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"campos" | "json">("campos");
  const [vistaMovil, setVistaMovil] = useState<"documento" | "datos">("documento");
  const [copied, setCopied] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<{ chunks: number } | null>(null);

  // Se revalida en cada edición: los errores se actualizan al escribir
  const issues = useMemo(
    () => (extraction ? validarExtraccion(extraction) : {}),
    [extraction],
  );
  const claves = Object.keys(issues);

  // Libera la URL de la vista previa al cambiar de archivo o desmontar
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      setStatus({ kind: "error", message: "Ese formato no se admite. Sube una imagen (PNG, JPG, WEBP, GIF) o un PDF." });
      return;
    }
    const requestId = ++requestRef.current;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setExtraction(null);
    setGuardado(null);
    setVistaMovil("documento");
    setStatus({ kind: "uploading" });

    const body = new FormData();
    body.append("file", f);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await leerJson(res, "No se pudo subir el archivo");
      if (requestId !== requestRef.current) return;
      setStatus({ kind: "uploaded", id: data.id });
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  async function analyze(id: string) {
    const requestId = ++requestRef.current;
    setStatus({ kind: "analyzing", id });
    setGuardado(null);
    setVistaMovil("datos");
    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: "POST" });
      const data = await leerJson(res, "No se pudo analizar el documento");
      if (requestId !== requestRef.current) return;
      setExtraction(data.extraction);
      setNumericos(caminosNumericos(data.extraction.datos));
      setStatus({ kind: "analyzed", id });
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setStatus({ kind: "error", message: (err as Error).message, id });
    }
  }

  async function confirmar(id: string) {
    if (!extraction) return;
    setGuardando(true);
    setGuardado(null);
    try {
      const res = await fetch(`/api/documents/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction }),
      });
      const data = await leerJson(res, "No se pudo guardar");
      setGuardado({ chunks: data.chunks });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message, id });
    } finally {
      setGuardando(false);
    }
  }

  function reset() {
    requestRef.current++;
    setFile(null);
    setPreviewUrl(null);
    setExtraction(null);
    setGuardado(null);
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(extraction, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function irAlCampo(clave: string) {
    setTab("campos");
    setVistaMovil("datos");
    requestAnimationFrame(() => {
      const el = document.getElementById(idCampo(clave));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  }

  const docId =
    status.kind === "uploaded" ||
    status.kind === "analyzing" ||
    status.kind === "analyzed" ||
    status.kind === "error"
      ? status.id
      : undefined;

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      onChange={(e) => handleFile(e.target.files?.[0])}
    />
  );

  // ------------------------------------------------------------ sin archivo
  if (!file || !previewUrl) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4 sm:py-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Revisar un documento</h1>
          <p className="text-[15px] text-muted">
            Sube una factura, un recibo o un contrato. La IA extrae sus datos y tú los
            revisas junto al original antes de guardarlos.
          </p>
        </div>

        {status.kind === "error" && <Aviso tono="error">{status.message}</Aviso>}

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-[1.5px] border-dashed px-6 py-14 text-center transition-colors duration-150 has-[:focus-visible]:border-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/20 sm:py-20 ${
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-surface hover:border-accent/60 hover:bg-accent-soft/40"
          }`}
        >
          {input}
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Upload className="size-6" aria-hidden />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold text-ink">
              Arrastra aquí un archivo
            </span>
            <span className="text-muted">
              o <span className="font-medium text-accent underline-offset-3 group-hover:underline">elígelo en tu equipo</span>
              <span className="sm:hidden"> o haz una foto</span>
            </span>
          </span>
          <span className="text-xs text-muted">PNG, JPG, WEBP, GIF o PDF de hasta 10 páginas · máx. 20 MB</span>
        </label>

        <ol className="grid gap-4 text-[13px] sm:grid-cols-3">
          {[
            ["Sube", "Imagen o PDF, también escaneado o fotografiado."],
            ["La IA extrae", "Clasifica el documento y rellena sus campos."],
            ["Revisa y guarda", "Corrige lo marcado en rojo y confirma."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-xs font-semibold text-ink-2 tabular">
                {i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">{t}</span>
                <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ------------------------------------------------------------ con archivo
  const esPdf = file.type === "application/pdf";
  const analizando = status.kind === "analyzing";
  const fallo = status.kind === "error";
  const estadoAnalisis: Paso = analizando
    ? "actual"
    : extraction
      ? "hecho"
      : fallo && docId
        ? "error"
        : "pendiente";

  const pasos = [
    {
      label: "Subido",
      estado: (status.kind === "uploading" ? "actual" : fallo && !docId ? "error" : "hecho") as Paso,
    },
    { label: "Analizado", estado: estadoAnalisis },
    {
      label: "Guardado",
      estado: (guardando ? "actual" : guardado ? "hecho" : "pendiente") as Paso,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {input}

      {/* Cabecera del documento */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted shadow-sm">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold text-ink" title={file.name}>
            {file.name}
          </h1>
          <p className="text-xs text-muted tabular">
            {formatoTamano(file.size)}
            {docId && <> · Nº {docId}</>}
          </p>
        </div>
        <Pasos pasos={pasos} />
        <div className="flex gap-2">
          <Boton tamano="sm" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden />
            Otro archivo
          </Boton>
          <Boton tamano="sm" variante="fantasma" onClick={reset} aria-label="Quitar documento">
            <X aria-hidden />
          </Boton>
        </div>
      </div>

      {/* En móvil, documento y datos se alternan */}
      <div role="tablist" aria-label="Vista" className="grid grid-cols-2 rounded-md bg-subtle p-1 lg:hidden">
        {(["documento", "datos"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={vistaMovil === v}
            onClick={() => setVistaMovil(v)}
            className={`flex h-8 items-center justify-center gap-1.5 rounded text-[13px] font-medium ${
              vistaMovil === v ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {v === "documento" ? "Documento" : "Datos"}
            {v === "datos" && claves.length > 0 && (
              <span className="rounded-full bg-bad px-1.5 text-[11px] leading-4 text-on-accent tabular">{claves.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Original */}
        <section
          aria-label="Documento original"
          className={`overflow-hidden rounded-lg border border-line bg-surface shadow-sm lg:sticky lg:top-20 ${
            vistaMovil === "documento" ? "" : "max-lg:hidden"
          }`}
        >
          <div className="flex h-10 items-center justify-between border-b border-line px-3">
            <span className="text-xs font-medium text-muted">Original</span>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded text-xs font-medium text-accent hover:underline"
            >
              Abrir <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          <div className="grid bg-subtle">
            {esPdf ? (
              <iframe src={previewUrl} title={`Vista previa de ${file.name}`} className="h-[70vh] w-full lg:h-[calc(100vh-11rem)]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Vista previa de ${file.name}`}
                className="mx-auto max-h-[70vh] w-auto object-contain lg:max-h-[calc(100vh-11rem)]"
              />
            )}
          </div>
        </section>

        {/* Revisión */}
        <section
          aria-label="Datos extraídos"
          className={`flex min-w-0 flex-col rounded-lg border border-line bg-surface shadow-sm ${
            vistaMovil === "datos" ? "" : "max-lg:hidden"
          }`}
        >
          {status.kind === "uploading" && (
            <div className="flex items-center gap-2 p-5 text-muted" role="status">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Subiendo el archivo…
            </div>
          )}

          {analizando && <Analizando />}

          {fallo && (
            <div className="p-5">
              <Aviso
                tono="error"
                accion={
                  docId && (
                    <Boton tamano="sm" onClick={() => analyze(docId)}>
                      <RotateCw aria-hidden />
                      Reintentar
                    </Boton>
                  )
                }
              >
                {status.message}
              </Aviso>
            </div>
          )}

          {status.kind === "uploaded" && !extraction && (
            <div className="flex flex-col items-start gap-4 p-5 sm:p-6">
              <span className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent">
                <ScanText className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-ink">Listo para analizar</h2>
                <p className="text-muted">
                  El archivo ya está subido. La IA lo clasificará y extraerá sus datos
                  para que los revises aquí, campo a campo.
                </p>
              </div>
              <Boton variante="primario" onClick={() => analyze(status.id)}>
                <ScanText aria-hidden />
                Analizar con IA
              </Boton>
            </div>
          )}

          {extraction && !analizando && (
            <>
              {/* Resumen del análisis */}
              <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono="acento">{TIPO_LABEL[extraction.tipo] ?? extraction.tipo}</Insignia>
                  <span className="text-xs text-muted tabular">
                    Confianza del modelo {Math.round(extraction.confianza * 100)} %
                  </span>
                  {docId && (
                    <Boton tamano="sm" variante="fantasma" className="ml-auto" onClick={() => analyze(docId)}>
                      <RotateCw aria-hidden />
                      <span className="max-sm:sr-only">Volver a analizar</span>
                    </Boton>
                  )}
                </div>
                {extraction.resumen && <p className="text-[15px] text-ink">{extraction.resumen}</p>}

                {claves.length > 0 ? (
                  <Aviso tono="error">
                    <p className="font-medium">
                      {claves.length === 1
                        ? "1 campo necesita revisión"
                        : `${claves.length} campos necesitan revisión`}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {claves.map((c) => (
                        <li key={c}>
                          <button
                            onClick={() => irAlCampo(c)}
                            className="text-left underline decoration-bad/40 underline-offset-3 hover:decoration-bad"
                          >
                            <span className="font-medium">{nombreCampo(c)}</span>: {issues[c]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Aviso>
                ) : (
                  <Aviso tono="ok">Todos los campos son válidos. Revísalos contra el original y guarda.</Aviso>
                )}
              </div>

              {/* Campos / JSON */}
              <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-5">
                <div role="tablist" aria-label="Formato" className="flex gap-1 rounded-md bg-subtle p-0.5">
                  {(
                    [
                      ["campos", "Campos", Rows3],
                      ["json", "JSON", Braces],
                    ] as const
                  ).map(([t, l, Icono]) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium ${
                        tab === t ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      <Icono className="size-3.5" aria-hidden />
                      {l}
                    </button>
                  ))}
                </div>
                <Boton tamano="sm" variante="fantasma" onClick={copyJson}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copiado" : "Copiar JSON"}
                </Boton>
              </div>

              <div className="p-4 sm:p-5">
                {tab === "campos" ? (
                  <DataEditor
                    datos={extraction.datos}
                    issues={issues}
                    orden={camposEsperados(extraction.tipo)}
                    numericos={numericos}
                    onChange={(datos) => {
                      setGuardado(null);
                      setExtraction({ ...extraction, datos });
                    }}
                  />
                ) : (
                  <pre className="max-h-[60vh] overflow-auto rounded-md border border-line bg-subtle p-3 font-mono text-xs leading-relaxed text-ink-2">
                    {JSON.stringify(extraction, null, 2)}
                  </pre>
                )}
              </div>

              {/* Acción principal, siempre a mano */}
              <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-b-lg border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                {guardado ? (
                  <>
                    <p className="flex items-center gap-1.5 font-medium text-ok" role="status">
                      <CircleCheck className="size-4" aria-hidden />
                      Guardado · {guardado.chunks} fragmento{guardado.chunks === 1 ? "" : "s"} indexado{guardado.chunks === 1 ? "" : "s"}
                    </p>
                    <Link href="/documentos" className={`${claseBoton("secundario", "sm")} ml-auto`}>
                      Ver en Documentos
                      <ArrowRight aria-hidden />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="min-w-0 flex-1 text-xs text-muted">
                      {claves.length > 0
                        ? "Corrige los campos marcados para poder guardar."
                        : "Se guardará en su tabla y se indexará para el chat."}
                    </p>
                    <Boton
                      variante="primario"
                      onClick={() => docId && confirmar(docId)}
                      disabled={guardando || claves.length > 0}
                    >
                      {guardando ? (
                        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <Check aria-hidden />
                      )}
                      {guardando ? "Guardando…" : "Confirmar y guardar"}
                    </Boton>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
