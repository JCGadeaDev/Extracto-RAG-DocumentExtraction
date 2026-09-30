/**
 * URL absoluta con el protocolo y el host que ve el navegador. Detrás de un
 * balanceador que termina TLS, request.url llega como http y a veces con el
 * host o el puerto internos; las cabeceras X-Forwarded-* traen los públicos.
 */
export function urlPublica(request: Request, ruta: string): URL {
  const interna = new URL(request.url);
  const primero = (cabecera: string) =>
    request.headers.get(cabecera)?.split(",")[0].trim() || undefined;

  const protocolo = primero("x-forwarded-proto") ?? interna.protocol.replace(":", "");
  const host = primero("x-forwarded-host") ?? primero("host") ?? interna.host;
  return new URL(ruta, `${protocolo}://${host}`);
}

export function esHttps(request: Request): boolean {
  return urlPublica(request, "/").protocol === "https:";
}
