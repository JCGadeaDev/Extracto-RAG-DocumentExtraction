import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import DocumentsTable from "@/components/documents-table";
import { claseBoton } from "@/components/ui";

export const metadata: Metadata = { title: "Documentos" };

export default function Documentos() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Documentos</h1>
          <p className="text-muted">Lo que has revisado y confirmado, con sus datos ya en tablas.</p>
        </div>
        <Link href="/" className={claseBoton("primario")}>
          <Upload aria-hidden />
          Revisar documento
        </Link>
      </div>
      <DocumentsTable />
    </div>
  );
}
