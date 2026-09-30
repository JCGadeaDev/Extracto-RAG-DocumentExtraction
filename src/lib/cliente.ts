// Respuestas de la API tal como llegan al navegador; cada pantalla lee sus campos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Datos = Record<string, any>;

/**
 * Lee la respuesta JSON de la API. Si falla, el error lleva el mensaje del
 * servidor o, cuando no hay (un 500 sin cuerpo, un corte de red), uno legible
 * en lugar del error técnico del navegador.
 */
export async function leerJson(res: Response, porDefecto: string): Promise<Datos> {
  let data: Datos | null = null;
  try {
    data = await res.json();
  } catch {
    // Cuerpo vacío o que no es JSON
  }
  if (!res.ok) {
    throw new Error(
      data?.error ?? `${porDefecto}: el servidor respondió con un error (${res.status}). Inténtalo de nuevo en un momento.`,
    );
  }
  if (!data) throw new Error(`${porDefecto}: la respuesta del servidor llegó vacía.`);
  return data;
}
