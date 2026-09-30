"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import type { Issues } from "@/lib/schemas";

type Json = unknown;

// Nombres de los campos del esquema (ver src/lib/extract.ts) tal como se leen
const ETIQUETAS: Record<string, string> = {
  numero: "Número",
  fecha: "Fecha",
  fecha_emision: "Fecha de emisión",
  fecha_vencimiento: "Fecha de vencimiento",
  fecha_firma: "Fecha de firma",
  fecha_inicio: "Fecha de inicio",
  fecha_fin: "Fecha de fin",
  emisor: "Emisor",
  receptor: "Receptor",
  comercio: "Comercio",
  nombre: "Nombre",
  id_fiscal: "NIF / ID fiscal",
  direccion: "Dirección",
  conceptos: "Conceptos",
  descripcion: "Descripción",
  cantidad: "Cantidad",
  precio_unitario: "Precio unitario",
  importe: "Importe",
  subtotal: "Subtotal",
  impuestos: "Impuestos",
  tipo: "Tipo",
  tasa: "Tasa (%)",
  total: "Total",
  moneda: "Moneda",
  forma_pago: "Forma de pago",
  metodo_pago: "Método de pago",
  titulo: "Título",
  tipo_contrato: "Tipo de contrato",
  partes: "Partes",
  rol: "Rol",
  objeto: "Objeto",
  condiciones_pago: "Condiciones de pago",
  duracion: "Duración",
  clausulas_clave: "Cláusulas clave",
  jurisdiccion: "Jurisdicción",
};

export function label(key: string) {
  if (ETIQUETAS[key]) return ETIQUETAS[key];
  const texto = key.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Devuelve una copia con `path` cambiado; crea objetos/arrays según el tramo. */
export function setAt(root: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (typeof head === "number") {
    const arr = Array.isArray(root) ? [...root] : [];
    arr[head] = setAt(arr[head], rest, value);
    return arr;
  }
  const obj = { ...((root ?? {}) as Record<string, Json>) };
  obj[head] = setAt(obj[head], rest, value);
  return obj;
}

function getAt(root: Json, path: (string | number)[]): Json {
  return path.reduce<Json>(
    (acc, k) =>
      acc === null || acc === undefined
        ? undefined
        : (acc as Record<string | number, Json>)[k],
    root,
  );
}

/**
 * Un campo obligatorio que falta no tiene entrada que pintar, así que se crea
 * vacío para que el usuario pueda rellenarlo.
 */
function conCamposQueFaltan(
  datos: Record<string, Json>,
  issues: Issues,
): Record<string, Json> {
  let resultado = datos;
  for (const clave of Object.keys(issues)) {
    const path = clave.split(".").slice(1).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
    if (path.length > 0 && getAt(resultado, path) === undefined) {
      resultado = setAt(resultado, path, "") as Record<string, Json>;
    }
  }
  return resultado;
}

/**
 * Rutas cuyo valor llegó como número en el análisis. Se calcula una sola vez
 * sobre el resultado del modelo: si se dedujera del valor actual, un estado
 * intermedio al escribir (p. ej. "99.") convertiría el campo en texto para
 * siempre.
 */
export function caminosNumericos(value: Json, path: (string | number)[] = []): Set<string> {
  const rutas = new Set<string>();
  if (typeof value === "number") {
    rutas.add(path.join("."));
  } else if (Array.isArray(value)) {
    value.forEach((v, i) =>
      caminosNumericos(v, [...path, i]).forEach((r) => rutas.add(r)),
    );
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, Json>)) {
      caminosNumericos(v, [...path, k]).forEach((r) => rutas.add(r));
    }
  }
  return rutas;
}

/** Texto → número cuando toca; si no se puede, se deja tal cual y zod lo marca. */
function parseValue(raw: string, esNumerico: boolean): Json {
  if (!esNumerico) return raw;
  if (raw.trim() === "") return undefined;
  const normalizado = raw.replace(",", ".");
  return /^-?\d*\.?\d+$/.test(normalizado) ? Number(normalizado) : raw;
}


type Ruta = (string | number)[];

type FieldProps = {
  path: Ruta;
  value: Json;
  issues: Issues;
  numericos: Set<string>;
  onChange: (path: Ruta, value: Json) => void;
};

function clave(path: Ruta) {
  return ["datos", ...path].join(".");
}

/** Id del control de un campo; lo usa el resumen de errores para llevar hasta él. */
export function idCampo(claveIssue: string) {
  return `campo-${claveIssue.replace(/[^\w-]/g, "-")}`;
}

function nombre(n: string | number) {
  return typeof n === "number" ? `Línea ${n + 1}` : label(n);
}

function esGrupo(value: Json) {
  return value !== null && typeof value === "object";
}

function MensajeError({ id, texto }: { id: string; texto: string }) {
  return (
    <span id={id} className="flex items-start gap-1 text-xs text-bad">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {texto}
    </span>
  );
}

function Field({ path, value, issues, numericos, onChange }: FieldProps) {
  const n = path[path.length - 1];
  const error = issues[clave(path)];

  if (Array.isArray(value)) {
    return (
      <Grupo nombre={nombre(n)} error={error} id={idCampo(clave(path))}>
        {value.length === 0 && <p className="text-xs text-muted">Sin elementos.</p>}
        <ol className="flex flex-col gap-3">
          {value.map((item, i) => (
            <li key={i} className="rounded-md border border-line bg-subtle/60 p-3">
              {esGrupo(item) ? (
                <Campos
                  path={[...path, i]}
                  value={item as Record<string, Json>}
                  issues={issues}
                  numericos={numericos}
                  onChange={onChange}
                  titulo={nombre(i)}
                />
              ) : (
                <Field
                  path={[...path, i]}
                  value={item}
                  issues={issues}
                  numericos={numericos}
                  onChange={onChange}
                />
              )}
            </li>
          ))}
        </ol>
      </Grupo>
    );
  }

  if (esGrupo(value)) {
    return (
      <Grupo nombre={nombre(n)} error={error} id={idCampo(clave(path))}>
        <Campos
          path={path}
          value={value as Record<string, Json>}
          issues={issues}
          numericos={numericos}
          onChange={onChange}
        />
      </Grupo>
    );
  }

  const id = idCampo(clave(path));
  const esNumerico = numericos.has(path.join("."));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-2">
        {nombre(n)}
      </label>
      <TextInput
        id={id}
        value={value}
        esNumerico={esNumerico}
        error={error}
        onChange={(v) => onChange(path, v)}
      />
      {error && <MensajeError id={`${id}-error`} texto={error} />}
    </div>
  );
}

/** Campos de un objeto: los simples en rejilla, los compuestos a todo el ancho. */
function Campos({
  path,
  value,
  titulo,
  ...resto
}: Omit<FieldProps, "value"> & { value: Record<string, Json>; titulo?: string }) {
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {titulo && (
        <p className="col-span-full text-xs font-semibold text-muted tabular">{titulo}</p>
      )}
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className={esGrupo(v) ? "col-span-full" : undefined}>
          <Field path={[...path, k]} value={v} {...resto} />
        </div>
      ))}
    </div>
  );
}

/**
 * Conserva lo que el usuario teclea mientras edita: si el texto se regenerase
 * desde el número, "99.00" se quedaría en "99" y el siguiente dígito lo
 * convertiría en "990".
 */
function TextInput({
  id,
  value,
  esNumerico,
  error,
  onChange,
}: {
  id: string;
  value: Json;
  esNumerico: boolean;
  error?: string;
  onChange: (value: Json) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const texto =
    draft ?? (value === null || value === undefined ? "" : String(value));

  return (
    <input
      id={id}
      value={texto}
      inputMode={esNumerico ? "decimal" : undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseValue(e.target.value, esNumerico));
      }}
      onBlur={() => setDraft(null)}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`h-9 w-full min-w-0 rounded-md border bg-surface px-2.5 text-sm text-ink shadow-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-accent/20 ${
        esNumerico ? "tabular" : ""
      } ${
        error
          ? "border-bad bg-bad-soft/40 focus:border-bad focus:ring-bad/20"
          : "border-line-strong hover:border-muted"
      }`}
    />
  );
}

function Grupo({
  nombre,
  error,
  id,
  children,
}: {
  nombre: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      id={id}
      tabIndex={error ? -1 : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex min-w-0 flex-col gap-3 border-t border-line pt-3"
    >
      <legend className="float-left mb-3 w-full text-[13px] font-semibold text-ink">{nombre}</legend>
      {error && <MensajeError id={`${id}-error`} texto={error} />}
      {children}
    </fieldset>
  );
}

export default function DataEditor({
  datos,
  issues,
  orden,
  numericos,
  onChange,
}: {
  datos: Record<string, Json>;
  issues: Issues;
  /** Campos del esquema, para mostrarlos siempre en el mismo orden */
  orden: string[];
  /** Rutas que deben editarse como número (ver caminosNumericos) */
  numericos: Set<string>;
  onChange: (datos: Record<string, Json>) => void;
}) {
  function update(path: Ruta, value: Json) {
    onChange(setAt(datos, path, value) as Record<string, Json>);
  }

  const completos = conCamposQueFaltan(datos, issues);
  const ordenados = Object.fromEntries(
    Object.entries(completos).sort(([a], [b]) => {
      const ia = orden.indexOf(a);
      const ib = orden.indexOf(b);
      return (ia < 0 ? orden.length : ia) - (ib < 0 ? orden.length : ib);
    }),
  );
  if (Object.keys(ordenados).length === 0) {
    return (
      <p className="text-sm text-muted">
        El modelo no extrajo ningún dato de este documento. Prueba a analizarlo de
        nuevo o sube una imagen más nítida.
      </p>
    );
  }

  return (
    <Campos path={[]} value={ordenados} issues={issues} numericos={numericos} onChange={update} />
  );
}
