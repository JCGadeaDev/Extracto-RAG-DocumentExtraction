"use client";

import { useEffect, useState } from "react";
import type { DocumentoGuardado } from "./api/documents/route";

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  recibo: "Recibo",
  contrato: "Contrato",
  otro: "Otro",
};

export default function DocumentsList({ version }: { version: number }) {
  const [documentos, setDocumentos] = useState<DocumentoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `version` cambia al confirmar un documento, y así se recarga la lista
  useEffect(() => {
    let cancelado = false;
    fetch("/api/documents")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al cargar");
        if (!cancelado) setDocumentos(data.documentos);
      })
      .catch((err) => !cancelado && setError((err as Error).message));
    return () => {
      cancelado = true;
    };
  }, [version]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Documentos guardados</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {documentos?.length === 0 && (
        <p className="text-sm text-zinc-500">
          Todavía no hay ninguno. Analiza un documento y pulsa Confirmar y guardar.
        </p>
      )}

      {documentos && documentos.length > 0 && (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {documentos.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {TIPO_LABEL[doc.tipo] ?? doc.tipo}
              </span>
              <span className="font-medium">{doc.titulo}</span>
              {doc.detalle && (
                <span className="text-zinc-500">{doc.detalle}</span>
              )}
              {doc.fecha && <span className="text-zinc-500">{doc.fecha}</span>}
              {doc.importe !== null && (
                <span className="font-medium">
                  {doc.importe.toFixed(2)} {doc.moneda ?? ""}
                </span>
              )}
              <span className="ml-auto text-xs text-zinc-500">
                {doc.chunks} fragmento{doc.chunks === 1 ? "" : "s"} · guardado{" "}
                {doc.confirmed_at}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
