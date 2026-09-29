"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsultaSQL, Fuente, Mensaje, RespuestaChat } from "@/lib/chat";

type Turno = Mensaje & Partial<Omit<RespuestaChat, "respuesta">>;

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  recibo: "Recibo",
  contrato: "Contrato",
  otro: "Otro",
};

const EJEMPLOS = [
  "¿Cuánto he gastado en total?",
  "¿Qué facturas vencen este mes?",
  "¿Quiénes firman el contrato de arrendamiento?",
];

const CITA = /(\[\d+(?:\s*,\s*\d+)*\])/g;

/** Pinta el texto con las citas [n] como enlaces a su fuente. */
function TextoConCitas({ texto, fuentes, turno }: { texto: string; fuentes: Fuente[]; turno: number }) {
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {texto.split(CITA).map((parte, i) => {
        // Con el grupo de captura, las posiciones impares son las citas
        if (i % 2 === 0) return parte;
        const numeros = parte.slice(1, -1).split(",").map((n) => Number(n.trim()));
        return numeros.map((n) =>
          fuentes.some((f) => f.n === n) ? (
            <a
              key={`${i}-${n}`}
              href={`#fuente-${turno}-${n}`}
              className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 align-text-top text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
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
    <details className="rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
      <summary className="cursor-pointer text-zinc-500">
        Calculado con SQL · {consulta.filas.length}
        {consulta.truncado ? "+" : ""} fila{consulta.filas.length === 1 ? "" : "s"}
        {consulta.documentos > 0 &&
          ` · ${consulta.documentos} documento${consulta.documentos === 1 ? "" : "s"}`}
      </summary>
      <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-2 font-mono text-zinc-100">
        {consulta.sql}
      </pre>
      {filas.length > 0 && (
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {consulta.columnas.map((c) => (
                  <th
                    key={c}
                    className="border-b border-zinc-200 px-2 py-1 font-medium dark:border-zinc-800"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {consulta.columnas.map((c) => (
                    <td
                      key={c}
                      className="border-b border-zinc-100 px-2 py-1 tabular-nums dark:border-zinc-900"
                    >
                      {valorCelda(fila[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {consulta.filas.length > filas.length && (
            <p className="mt-1 text-zinc-500">
              Se muestran {filas.length} de {consulta.filas.length} filas.
            </p>
          )}
        </div>
      )}
    </details>
  );
}

function Fuentes({
  fuentes,
  turno,
  consulta,
}: {
  fuentes: Fuente[];
  turno: number;
  consulta?: ConsultaSQL;
}) {
  if (fuentes.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        {consulta
          ? "Sin documentos: el resultado no incluye ninguno."
          : "Sin fuentes: la respuesta no se apoya en ningún documento guardado."}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {fuentes.map((f) => (
        <li
          key={f.n}
          id={`fuente-${turno}-${f.n}`}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {f.n}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
              {TIPO_LABEL[f.tipo] ?? f.tipo}
            </span>
            <span className="font-medium">{f.titulo}</span>
            {f.detalle && <span className="text-zinc-500">{f.detalle}</span>}
            <a
              href={`/api/documents/${f.document_id}/file`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              {f.filename} ↗
            </a>
          </div>
          {f.fragmentos.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-zinc-500">
                Ver fragmento{f.fragmentos.length > 1 ? "s" : ""}
                {f.similitud !== null &&
                  ` · similitud ${Math.round(f.similitud * 100)}%`}
              </summary>
              {f.fragmentos.map((t, i) => (
                <pre
                  key={i}
                  className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {t}
                </pre>
              ))}
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Chat() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al responder");
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
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Pregunta a tus documentos</h2>
        {turnos.length > 0 && (
          <button
            onClick={() => {
              setTurnos([]);
              setError(null);
            }}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Nueva conversación
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        {turnos.length === 0 && !cargando && (
          <div className="flex flex-col gap-2 text-sm text-zinc-500">
            <p>
              Busca por significado entre los documentos guardados. Cada
              respuesta cita el documento del que sale el dato.
            </p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map((e) => (
                <button
                  key={e}
                  onClick={() => enviar(e)}
                  className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {turnos.map((t, i) =>
          t.rol === "usuario" ? (
            <div
              key={i}
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {t.texto}
            </div>
          ) : (
            <div key={i} className="flex max-w-[95%] flex-col gap-2 text-sm">
              <TextoConCitas texto={t.texto} fuentes={t.fuentes ?? []} turno={i} />
              {t.consulta && <DetalleSQL consulta={t.consulta} />}
              <Fuentes fuentes={t.fuentes ?? []} turno={i} consulta={t.consulta} />
              {t.consulta && t.consulta.documentos > t.fuentes!.length && (
                <p className="text-xs text-zinc-500">
                  Y {t.consulta.documentos - t.fuentes!.length} documentos más.
                </p>
              )}
            </div>
          ),
        )}

        {cargando && (
          <p className="animate-pulse text-sm text-zinc-500">
            Buscando en tus documentos…
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div ref={finalRef} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(pregunta);
          }}
          className="flex gap-2"
        >
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Escribe una pregunta…"
            maxLength={4000}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={cargando || !pregunta.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Preguntar
          </button>
        </form>
      </div>
    </section>
  );
}
