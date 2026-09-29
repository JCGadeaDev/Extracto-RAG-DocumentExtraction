"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DataEditor, { caminosNumericos } from "./data-editor";
import DocumentsList from "./documents-list";
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

const TIPO_LABEL: Record<Extraction["tipo"], string> = {
  factura: "Factura",
  recibo: "Recibo",
  contrato: "Contrato",
  otro: "Otro documento",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Uploader() {
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
  const [copied, setCopied] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  // Al cambiar, la lista de documentos guardados se recarga
  const [listVersion, setListVersion] = useState(0);

  // Se revalida en cada edición: los errores se actualizan al escribir
  const issues = useMemo(
    () => (extraction ? validarExtraccion(extraction) : {}),
    [extraction],
  );
  const numIssues = Object.keys(issues).length;

  // Libera la URL de la vista previa al cambiar de archivo o desmontar
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      setStatus({ kind: "error", message: "Solo se aceptan imágenes o PDF" });
      return;
    }
    const requestId = ++requestRef.current;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setExtraction(null);
    setStatus({ kind: "uploading" });

    const body = new FormData();
    body.append("file", f);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
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
    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      if (requestId !== requestRef.current) return;
      setExtraction(data.extraction);
      setNumericos(caminosNumericos(data.extraction.datos));
      setGuardado(null);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setGuardado(
        `Guardado en la base de datos · ${data.chunks} fragmento${
          data.chunks === 1 ? "" : "s"
        } con embeddings`,
      );
      setListVersion((v) => v + 1);
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

  const docId =
    status.kind === "uploaded" ||
    status.kind === "analyzing" ||
    status.kind === "analyzed" ||
    status.kind === "error"
      ? status.id
      : undefined;

  return (
    <div className="flex w-full flex-col gap-6">
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <span className="text-base font-medium">
          Arrastra una imagen o PDF aquí
        </span>
        <span className="text-sm text-zinc-500">
          o haz clic para seleccionar · PNG, JPG, WEBP, GIF, PDF · máx. 20 MB
        </span>
      </label>

      {status.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {status.message}
        </p>
      )}

      {file && previewUrl && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-zinc-500">
                {formatSize(file.size)}
                {status.kind === "uploading" && " · Subiendo…"}
                {docId && ` · Guardado (#${docId})`}
              </p>
            </div>
            <div className="flex gap-2">
              {docId && (
                <button
                  onClick={() => analyze(docId)}
                  disabled={status.kind === "analyzing"}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {status.kind === "analyzing"
                    ? "Analizando…"
                    : extraction
                      ? "Volver a analizar"
                      : "Analizar"}
                </button>
              )}
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Quitar
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Documento */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 lg:sticky lg:top-6 lg:self-start dark:border-zinc-800 dark:bg-zinc-900">
              {file.type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title={file.name}
                  className="h-[80vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="mx-auto max-h-[80vh] object-contain"
                />
              )}
            </div>

            {/* Datos extraídos */}
            <div className="flex flex-col gap-4">
              {status.kind === "analyzing" && (
                <div className="animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  Detectando el tipo de documento y extrayendo sus datos…
                </div>
              )}

              {!extraction && status.kind !== "analyzing" && (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700">
                  Pulsa Analizar para extraer los datos del documento.
                </div>
              )}

              {extraction && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {TIPO_LABEL[extraction.tipo] ?? extraction.tipo}
                    </span>
                    <span className="text-sm text-zinc-500">
                      Confianza {Math.round(extraction.confianza * 100)}%
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        numIssues
                          ? "text-red-600"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {numIssues
                        ? `${numIssues} campo${numIssues > 1 ? "s" : ""} con errores`
                        : "Todo válido"}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {extraction.resumen}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
                      {(["campos", "json"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={`rounded-md px-3 py-1 ${
                            tab === t
                              ? "bg-white shadow-sm dark:bg-zinc-800"
                              : "text-zinc-500"
                          }`}
                        >
                          {t === "campos" ? "Campos" : "JSON"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={copyJson}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {copied ? "Copiado" : "Copiar JSON"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => docId && confirmar(docId)}
                      disabled={guardando || numIssues > 0}
                      title={
                        numIssues > 0
                          ? "Corrige los campos en rojo antes de guardar"
                          : undefined
                      }
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      {guardando ? "Guardando…" : "Confirmar y guardar"}
                    </button>
                    {guardado && (
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">
                        {guardado}
                      </span>
                    )}
                    {numIssues > 0 && (
                      <span className="text-sm text-zinc-500">
                        Corrige los campos en rojo para poder guardar.
                      </span>
                    )}
                  </div>

                  {tab === "campos" ? (
                    <DataEditor
                      datos={extraction.datos}
                      issues={issues}
                      orden={camposEsperados(extraction.tipo)}
                      numericos={numericos}
                      onChange={(datos) =>
                        setExtraction({ ...extraction, datos })
                      }
                    />
                  ) : (
                    <pre className="max-h-[70vh] overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
                      {JSON.stringify(extraction, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <DocumentsList version={listVersion} />
    </div>
  );
}
