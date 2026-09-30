"use client";

import { leerJson } from "@/lib/cliente";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Database,
  ExternalLink,
  FileSearch,
  LoaderCircle,
  MessageSquare,
  RotateCw,
  Send,
} from "lucide-react";
import type { ConsultaSQL, Fuente, Mensaje, RespuestaChat } from "@/lib/chat";
import { Aviso, Boton, Insignia, TIPO_LABEL } from "./ui";

type Turno = Mensaje & Partial<Omit<RespuestaChat, "respuesta">>;

const EJEMPLOS = [
  "¿Cuánto he gastado en total?",
  "¿Qué facturas vencen este mes?",
  "¿Quiénes firman el contrato de arrendamiento?",
];

const CITA = /(\[\d+(?:\s*,\s*\d+)*\])/g;

/** Pinta el texto con las citas [n] como enlaces a su fuente. */
function TextoConCitas({ texto, fuentes, turno }: { texto: string; fuentes: Fuente[]; turno: number }) {
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
      {texto.split(CITA).map((parte, i) => {
        // Con el grupo de captura, las posiciones impares son las citas
        if (i % 2 === 0) return parte;
        const numeros = parte.slice(1, -1).split(",").map((n) => Number(n.trim()));
        return numeros.map((n) =>
          fuentes.some((f) => f.n === n) ? (
            <a
              key={`${i}-${n}`}
              href={`#fuente-${turno}-${n}`}
              aria-label={`Fuente ${n}`}
              className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-accent-soft px-1 align-[1px] text-[11px] font-semibold text-accent-ink tabular no-underline hover:bg-accent hover:text-white"
            >
              {n}
            </a>
          ) : (
            <span key={`${i}-${n}`}>[{n}]</span>
          ),
        );
      })}
    </p>
  );
}

function valorCelda(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** SQL generado y su resultado, para comprobar de dónde sale la cifra. */
function DetalleSQL({ consulta }: { consulta: ConsultaSQL }) {
  const filas = consulta.filas.slice(0, 50);
  return (
    <details className="group rounded-md border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-ink-2 hover:bg-subtle">
        <Database className="size-3.5 text-muted" aria-hidden />
        Ver la consulta SQL y su resultado
        <span className="text-muted tabular">
          · {consulta.filas.length}
          {consulta.truncado ? "+" : ""} fila{consulta.filas.length === 1 ? "" : "s"}
        </span>
        <ChevronDown className="ml-auto size-3.5 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 border-t border-line p-3">
        <pre className="overflow-auto rounded bg-subtle p-2.5 font-mono text-xs whitespace-pre-wrap text-ink-2">
          {consulta.sql}
        </pre>
        {filas.length > 0 && (
          <div className="max-h-64 overflow-auto rounded border border-line">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-subtle">
                <tr>
                  {consulta.columnas.map((c) => (
                    <th key={c} scope="col" className="border-b border-line px-2.5 py-1.5 font-medium text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {consulta.columnas.map((c) => (
                      <td key={c} className="px-2.5 py-1.5 text-ink-2 tabular">
                        {valorCelda(fila[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {consulta.filas.length > filas.length && (
          <p className="text-xs text-muted">Se muestran {filas.length} de {consulta.filas.length} filas.</p>
        )}
      </div>
    </details>
  );
}

function Fuentes({ fuentes, turno, consulta }: { fuentes: Fuente[]; turno: number; consulta?: ConsultaSQL }) {
  if (fuentes.length === 0) {
    return (
      <p className="text-xs text-muted">
        {consulta
          ? "El resultado no incluye ningún documento."
          : "Sin fuentes: la respuesta no se apoya en ningún documento guardado."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">Fuentes</p>
      <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
        {fuentes.map((f) => (
          <li key={f.n} id={`fuente-${turno}-${f.n}`} className="scroll-mt-24 target:bg-accent-soft/50">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2.5">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-accent-soft px-1 text-[11px] font-semibold text-accent-ink tabular">
                {f.n}
              </span>
              <Insignia tono="neutro">{TIPO_LABEL[f.tipo] ?? f.tipo}</Insignia>
              <span className="min-w-0 truncate font-medium text-ink">{f.titulo}</span>
              {f.detalle && <span className="min-w-0 truncate text-muted">{f.detalle}</span>}
              <a
                href={`/api/documents/${f.document_id}/file`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded text-xs font-medium text-accent hover:underline"
              >
                Nº {f.document_id} · original
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
            {f.fragmentos.length > 0 && (
              <details className="group border-t border-line/70">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-ink">
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                  Fragmento usado{f.fragmentos.length > 1 ? `s (${f.fragmentos.length})` : ""}
                  {f.similitud !== null && (
                    <span className="tabular">· similitud {Math.round(f.similitud * 100)} %</span>
                  )}
                </summary>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  {f.fragmentos.map((t, i) => (
                    <blockquote
                      key={i}
                      className="max-h-48 overflow-auto rounded border border-line bg-subtle px-3 py-2 font-mono text-xs whitespace-pre-wrap text-ink-2"
                    >
                      {t}
                    </blockquote>
                  ))}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarcaAsistente() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-on-accent" aria-hidden>
      <MessageSquare className="size-4" />
    </span>
  );
}

export default function Chat() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (turnos.length || cargando) {
      finalRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turnos, cargando]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || cargando) return;

    const conPregunta: Turno[] = [...turnos, { rol: "usuario", texto: limpio }];
    setTurnos(conPregunta);
    setPregunta("");
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: conPregunta.map(({ rol, texto }) => ({ rol, texto })),
        }),
      });
      const data = await leerJson(res, "No se pudo responder");
      setTurnos([
        ...conPregunta,
        {
          rol: "asistente",
          texto: data.respuesta,
          fuentes: data.fuentes,
          modo: data.modo,
          consulta: data.consulta,
        },
      ]);
    } catch (err) {
      // Se quita la pregunta sin respuesta y se devuelve al campo para reintentar
      setTurnos(turnos);
      setPregunta(limpio);
      setError((err as Error).message);
    } finally {
      setCargando(false);
      campoRef.current?.focus();
    }
  }

  const vacio = turnos.length === 0 && !cargando;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="flex items-end justify-between gap-3 pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Preguntar</h1>
          <p className="text-muted">
            Pregunta sobre tus documentos guardados. Cada dato de la respuesta cita su documento de origen.
          </p>
        </div>
        {turnos.length > 0 && (
          <Boton
            tamano="sm"
            variante="fantasma"
            onClick={() => {
              setTurnos([]);
              setError(null);
            }}
          >
            <RotateCw aria-hidden />
            Nueva conversación
          </Boton>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6" aria-live="polite">
        {vacio && (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-sm">
            <p className="font-medium text-ink">Prueba con una de estas preguntas</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {EJEMPLOS.map((e) => (
                <Boton key={e} tamano="sm" onClick={() => enviar(e)} className="justify-start">
                  {e}
                </Boton>
              ))}
            </div>
            <p className="flex items-start gap-2 text-xs text-muted">
              <FileSearch className="mt-px size-3.5 shrink-0" aria-hidden />
              Busca por significado en el texto de los documentos. Las preguntas de totales y
              cálculos se responden con una consulta a las tablas cuando está disponible.
            </p>
          </div>
        )}

        {turnos.map((t, i) =>
          t.rol === "usuario" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-soft px-3.5 py-2.5 text-[15px] whitespace-pre-wrap text-ink">
                {t.texto}
              </p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <MarcaAsistente />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-ink-2">Extracto</span>
                  {t.modo === "sql" ? (
                    <Insignia tono="neutro" icono={<Database aria-hidden />}>Consulta SQL</Insignia>
                  ) : (
                    <Insignia tono="neutro" icono={<FileSearch aria-hidden />}>Búsqueda semántica</Insignia>
                  )}
                </div>
                <TextoConCitas texto={t.texto} fuentes={t.fuentes ?? []} turno={i} />
                {t.consulta && <DetalleSQL consulta={t.consulta} />}
                <Fuentes fuentes={t.fuentes ?? []} turno={i} consulta={t.consulta} />
                {t.consulta && t.consulta.documentos > (t.fuentes?.length ?? 0) && (
                  <p className="text-xs text-muted">
                    Y {t.consulta.documentos - (t.fuentes?.length ?? 0)} documentos más.
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {cargando && (
          <div className="flex gap-3" role="status">
            <MarcaAsistente />
            <p className="flex items-center gap-2 pt-1 text-muted">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Buscando en tus documentos…
            </p>
          </div>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}
        <div ref={finalRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
        className="sticky bottom-0 mt-6 bg-canvas pt-2 pb-4"
      >
        <div className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface p-2 shadow-md transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
          <label htmlFor="pregunta" className="sr-only">Pregunta</label>
          <textarea
            id="pregunta"
            ref={campoRef}
            rows={1}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(pregunta);
              }
            }}
            placeholder="Escribe una pregunta sobre tus documentos…"
            maxLength={4000}
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <Boton type="submit" variante="primario" disabled={cargando || !pregunta.trim()} aria-label="Enviar pregunta">
            <Send aria-hidden />
            <span className="max-sm:sr-only">Preguntar</span>
          </Boton>
        </div>
        <p className="mt-1.5 px-1 text-xs text-muted">Intro para enviar · Mayús + Intro para salto de línea</p>
      </form>
    </div>
  );
}
