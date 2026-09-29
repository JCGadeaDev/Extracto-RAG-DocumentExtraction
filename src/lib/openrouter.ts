const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELO_POR_DEFECTO = "deepseek/deepseek-v4.1-flash";

export type MensajeModelo = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Llama al modelo de chat de OpenRouter y devuelve el texto de la respuesta. */
export async function completar(
  messages: MensajeModelo[],
  opciones: { maxTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<string> {
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
      model: process.env.OPENROUTER_MODEL || MODELO_POR_DEFECTO,
      max_tokens: opciones.maxTokens ?? 2048,
      temperature: opciones.temperature ?? 0.2,
      // Si el modelo razona antes de responder, el razonamiento puede agotar
      // max_tokens y dejar la respuesta vacía; el chat no lo necesita
      reasoning: { enabled: false },
      messages,
      ...(opciones.json && { response_format: { type: "json_object" } }),
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `OpenRouter respondió ${res.status}`);
  }
  const eleccion = body.choices?.[0];
  const content: string | undefined = eleccion?.message?.content?.trim();
  if (!content) {
    throw new Error(
      eleccion?.finish_reason === "length"
        ? "El modelo agotó el límite de tokens sin responder"
        : "El modelo no devolvió contenido",
    );
  }
  return content;
}

/** Extrae el objeto JSON de una respuesta, aunque venga envuelto en ```json … ```. */
export function leerJson(content: string): unknown {
  const inicio = content.indexOf("{");
  const fin = content.lastIndexOf("}");
  if (inicio === -1 || fin < inicio) throw new Error("El modelo no devolvió JSON");
  return JSON.parse(content.slice(inicio, fin + 1));
}
