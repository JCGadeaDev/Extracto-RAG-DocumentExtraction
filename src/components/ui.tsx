import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

type Variante = "primario" | "secundario" | "fantasma";
type Tamano = "sm" | "md";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-accent text-on-accent shadow-sm hover:bg-accent-hover active:translate-y-px disabled:bg-accent/45",
  secundario:
    "border border-line-strong bg-surface text-ink shadow-sm hover:bg-subtle active:translate-y-px disabled:text-muted",
  fantasma: "text-ink-2 hover:bg-subtle hover:text-ink disabled:text-muted",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-[13px]",
  md: "h-9 gap-2 px-3.5 text-sm",
};

/** Clases de botón, para aplicarlas también a enlaces. */
export function claseBoton(variante: Variante = "secundario", tamano: Tamano = "md") {
  return `inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 disabled:cursor-not-allowed [&_svg]:size-4 ${VARIANTES[variante]} ${TAMANOS[tamano]}`;
}

export function Boton({
  variante = "secundario",
  tamano = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamano?: Tamano }) {
  return (
    <button type="button" className={`${claseBoton(variante, tamano)} ${className}`} {...props} />
  );
}

export type Tono = "neutro" | "acento" | "ok" | "aviso" | "error";

const TONOS: Record<Tono, string> = {
  neutro: "bg-subtle text-ink-2 ring-line",
  acento: "bg-accent-soft text-accent-ink ring-accent/20",
  ok: "bg-ok-soft text-ok ring-ok/20",
  aviso: "bg-warn-soft text-warn ring-warn/25",
  error: "bg-bad-soft text-bad ring-bad/20",
};

export function Insignia({
  tono = "neutro",
  icono,
  children,
}: {
  tono?: Tono;
  icono?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset [&_svg]:size-3.5 ${TONOS[tono]}`}
    >
      {icono}
      {children}
    </span>
  );
}

const ICONOS_AVISO = {
  info: Info,
  ok: CircleCheck,
  aviso: TriangleAlert,
  error: CircleAlert,
};

const TONOS_AVISO = {
  info: "border-line bg-subtle text-ink-2 [&>svg]:text-muted",
  ok: "border-ok/25 bg-ok-soft text-ok",
  aviso: "border-warn/25 bg-warn-soft text-warn",
  error: "border-bad/25 bg-bad-soft text-bad",
};

/** Mensaje en línea; los errores se anuncian a lectores de pantalla. */
export function Aviso({
  tono = "info",
  children,
  accion,
}: {
  tono?: keyof typeof TONOS_AVISO;
  children: ReactNode;
  accion?: ReactNode;
}) {
  const Icono = ICONOS_AVISO[tono];
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${TONOS_AVISO[tono]}`}
    >
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {accion}
    </div>
  );
}

export const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  recibo: "Recibo",
  contrato: "Contrato",
  otro: "Otro",
};

export function formatoTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function formatoImporte(importe: number, moneda: string | null) {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: moneda ?? "EUR",
      useGrouping: "always",
    }).format(importe);
  } catch {
    return `${importe.toFixed(2).replace(".", ",")} ${moneda ?? ""}`.trim();
  }
}

export function formatoFecha(iso: string | null) {
  if (!iso) return null;
  const [a, m, d] = iso.split(/[-T ]/);
  if (!a || !m || !d) return iso;
  return new Date(Number(a), Number(m) - 1, Number(d)).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
