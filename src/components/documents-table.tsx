"use client";

import { leerJson } from "@/lib/cliente";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Inbox, RotateCw, Upload } from "lucide-react";
import type { DocumentoGuardado } from "@/app/api/documents/route";
import {
  Aviso,
  Boton,
  Insignia,
  TIPO_LABEL,
  claseBoton,
  formatoFecha,
  formatoImporte,
} from "./ui";

export default function DocumentsTable() {
  const [documentos, setDocumentos] = useState<DocumentoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/documents")
      .then(async (res) => {
        const data = await leerJson(res, "No se pudo cargar la lista");
        if (!cancelado) setDocumentos(data.documentos);
      })
      .catch((err) => !cancelado && setError((err as Error).message));
    return () => {
      cancelado = true;
    };
  }, [intento]);

  if (error) {
    return (
      <Aviso
        tono="error"
        accion={
          <Boton
            tamano="sm"
            onClick={() => {
              setError(null);
              setIntento((n) => n + 1);
            }}
          >
            <RotateCw aria-hidden />
            Reintentar
          </Boton>
        }
      >
        {error}
      </Aviso>
    );
  }

  if (documentos === null) {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm" role="status" aria-label="Cargando documentos">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
            <div className="h-5 w-16 rounded-full bg-subtle" />
            <div className="h-3 w-1/4 rounded bg-subtle" />
            <div className="h-3 w-1/5 rounded bg-subtle" />
            <div className="ml-auto h-3 w-16 rounded bg-subtle" />
          </div>
        ))}
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-16 text-center shadow-sm">
        <span className="grid size-12 place-items-center rounded-full bg-subtle text-muted">
          <Inbox className="size-6" aria-hidden />
        </span>
        <div className="flex max-w-sm flex-col gap-1">
          <h2 className="font-semibold text-ink">Todavía no hay documentos guardados</h2>
          <p className="text-muted">
            Aquí aparecerá cada documento que confirmes, con sus datos ya en tablas y
            listo para preguntar sobre él.
          </p>
        </div>
        <Link href="/" className={claseBoton("primario")}>
          <Upload aria-hidden />
          Revisar el primero
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full sm:min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-subtle/60 text-xs font-medium text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium max-sm:hidden">Nº</th>
              <th scope="col" className="px-4 py-2.5 font-medium max-sm:hidden">Tipo</th>
              <th scope="col" className="px-4 py-2.5 font-medium max-sm:px-3">Documento</th>
              <th scope="col" className="px-4 py-2.5 font-medium max-sm:hidden">Emisor o partes</th>
              <th scope="col" className="px-4 py-2.5 font-medium max-sm:hidden">Fecha</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium max-sm:px-1">Importe</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium max-sm:hidden">Fragmentos</th>
              <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Archivo</span></th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((doc) => (
              <tr key={doc.id} className="border-b border-line last:border-0 hover:bg-subtle/50">
                <td className="px-4 py-3 text-xs text-muted tabular max-sm:hidden">{doc.id}</td>
                <td className="px-4 py-3 max-sm:hidden">
                  <Insignia tono={doc.tipo === "otro" ? "neutro" : "acento"}>
                    {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                  </Insignia>
                </td>
                <td className="max-w-[16rem] px-4 py-3 max-sm:max-w-[13rem] max-sm:px-3">
                  <p className="mb-0.5 text-xs font-medium text-accent-ink sm:hidden">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</p>
                  <p className="truncate font-medium text-ink" title={doc.titulo}>{doc.titulo}</p>
                  {doc.filename !== doc.titulo && (
                    <p className="truncate text-xs text-muted" title={doc.filename}>{doc.filename}</p>
                  )}
                  <p className="truncate text-xs text-muted sm:hidden">
                    {[doc.detalle, formatoFecha(doc.fecha)].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-3 text-ink-2 max-sm:hidden" title={doc.detalle ?? undefined}>
                  {doc.detalle ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-2 tabular max-sm:hidden">
                  {formatoFecha(doc.fecha) ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-ink tabular max-sm:px-1">
                  {doc.importe !== null ? formatoImporte(doc.importe, doc.moneda) : <span className="font-normal text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-ink-2 tabular max-sm:hidden">{doc.chunks}</td>
                <td className="px-4 py-3 text-right max-sm:pl-0 max-sm:pr-3">
                  <a
                    href={`/api/documents/${doc.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent hover:underline"
                  >
                    <span className="max-sm:sr-only">Original</span>
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted tabular">
        {documentos.length} documento{documentos.length === 1 ? "" : "s"} confirmado{documentos.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
