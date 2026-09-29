const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";
// Multilingüe y barato; devuelve 1024 dimensiones (ver db/init.sql)
const MODELO_POR_DEFECTO = "baai/bge-m3";
export const DIMENSIONES = 1024;

const TAMANO_CHUNK = 1000;
const SOLAPE = 150;

/**
 * Parte el texto en fragmentos con solape, cortando por saltos de línea para
 * no romper líneas de una factura por la mitad.
 */
export function trocear(texto: string): string[] {
  const limpio = texto.trim();
  if (limpio.length <= TAMANO_CHUNK) return limpio ? [limpio] : [];

  const chunks: string[] = [];
  let inicio = 0;
  while (inicio < limpio.length) {
    let fin = Math.min(inicio + TAMANO_CHUNK, limpio.length);
    if (fin < limpio.length) {
      const corte = limpio.lastIndexOf("\n", fin);
      if (corte > inicio + TAMANO_CHUNK / 2) fin = corte;
    }
    chunks.push(limpio.slice(inicio, fin).trim());
    if (fin >= limpio.length) break;
    inicio = Math.max(fin - SOLAPE, inicio + 1);
  }
  return chunks.filter(Boolean);
}

export async function embeddings(textos: string[]): Promise<number[][]> {
  if (textos.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta OPENROUTER_API_KEY");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Extracto",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_EMBEDDING_MODEL || MODELO_POR_DEFECTO,
      input: textos,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `OpenRouter respondió ${res.status}`);
  }

  // El orden de "data" no está garantizado: cada elemento trae su índice
  const porIndice = new Map<number, number[]>();
  for (const item of body.data ?? []) {
    porIndice.set(item.index, item.embedding);
  }

  return textos.map((_, i) => {
    const vector = porIndice.get(i);
    if (!vector) {
      throw new Error("El modelo no devolvió un embedding por fragmento");
    }
    if (vector.length !== DIMENSIONES) {
      throw new Error(
        `El modelo devolvió ${vector.length} dimensiones y la tabla espera ${DIMENSIONES}`,
      );
    }
    return vector;
  });
}

/** Formato que entiende pgvector: "[0.1,0.2,…]". */
export function aVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
