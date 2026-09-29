"use client";

import { useState } from "react";
import type { Issues } from "@/lib/schemas";

type Json = unknown;

function label(key: string) {
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

type FieldProps = {
  path: (string | number)[];
  value: Json;
  issues: Issues;
  numericos: Set<string>;
  onChange: (path: (string | number)[], value: Json) => void;
};

function key(path: (string | number)[]) {
  return ["datos", ...path].join(".");
}

function Field({ path, value, issues, numericos, onChange }: FieldProps) {
  const name = path[path.length - 1];
  const error = issues[key(path)];

  if (Array.isArray(value)) {
    return (
      <Group name={name} error={error}>
        {value.map((item, i) => (
          <div key={i} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
            <Field
              path={[...path, i]}
              value={item}
              issues={issues}
              numericos={numericos}
              onChange={onChange}
            />
          </div>
        ))}
      </Group>
    );
  }

  if (value !== null && typeof value === "object") {
    return (
      <Group name={name} error={error}>
        {Object.entries(value as Record<string, Json>).map(([k, v]) => (
          <Field
            key={k}
            path={[...path, k]}
            value={v}
            issues={issues}
            numericos={numericos}
            onChange={onChange}
          />
        ))}
      </Group>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">
        {typeof name === "number" ? `#${name + 1}` : label(name)}
      </span>
      <TextInput
        value={value}
        esNumerico={numericos.has(path.join("."))}
        error={error}
        onChange={(v) => onChange(path, v)}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

/**
 * Conserva lo que el usuario teclea mientras edita: si el texto se regenerase
 * desde el número, "99.00" se quedaría en "99" y el siguiente dígito lo
 * convertiría en "990".
 */
function TextInput({
  value,
  esNumerico,
  error,
  onChange,
}: {
  value: Json;
  esNumerico: boolean;
  error?: string;
  onChange: (value: Json) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const texto =
    draft ?? (value === null || value === undefined ? "" : String(value));

  return (
    <>
      <input
        value={texto}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseValue(e.target.value, esNumerico));
        }}
        onBlur={() => setDraft(null)}
        aria-invalid={Boolean(error)}
        className={`rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 ${
          error
            ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-200 dark:bg-red-950/40 dark:text-red-200"
            : "border-zinc-300 focus:ring-zinc-200 dark:border-zinc-700 dark:focus:ring-zinc-700"
        }`}
      />
    </>
  );
}

function Group({
  name,
  error,
  children,
}: {
  name: string | number;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      className={`flex flex-col gap-3 rounded-xl border p-3 ${
        error ? "border-red-500" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <legend className="px-1 text-xs font-semibold text-zinc-500">
        {typeof name === "number" ? `#${name + 1}` : label(name)}
      </legend>
      {error && <span className="text-xs text-red-600">{error}</span>}
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
  function update(path: (string | number)[], value: Json) {
    onChange(setAt(datos, path, value) as Record<string, Json>);
  }

  const entries = Object.entries(conCamposQueFaltan(datos, issues)).sort(
    ([a], [b]) => {
      const ia = orden.indexOf(a);
      const ib = orden.indexOf(b);
      return (ia < 0 ? orden.length : ia) - (ib < 0 ? orden.length : ib);
    },
  );
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        El modelo no extrajo ningún dato de este documento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([k, v]) => (
        <Field
          key={k}
          path={[k]}
          value={v}
          issues={issues}
          numericos={numericos}
          onChange={update}
        />
      ))}
    </div>
  );
}
