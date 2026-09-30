"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, MessageSquare, ScanText } from "lucide-react";

const SECCIONES = [
  { href: "/", label: "Revisar", icono: ScanText },
  { href: "/documentos", label: "Documentos", icono: Archive },
  { href: "/preguntar", label: "Preguntar", icono: MessageSquare },
];

export default function Nav() {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones" className="-mb-px flex h-full items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1">
      {SECCIONES.map(({ href, label, icono: Icono }) => {
        const activa = href === "/" ? ruta === "/" : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={`flex items-center gap-1.5 border-b-2 px-2 text-sm sm:gap-2 sm:px-2.5 font-medium whitespace-nowrap transition-colors duration-150 ${
              activa
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            <Icono className="size-4 max-sm:hidden" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
