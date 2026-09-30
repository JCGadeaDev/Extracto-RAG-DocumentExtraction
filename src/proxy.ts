import { NextResponse, type NextRequest } from "next/server";

/** Compara sin salir antes de tiempo, para no revelar cuántos caracteres coinciden. */
function iguales(a: string, b: string): boolean {
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

function credenciales(request: NextRequest): [string, string] | null {
  const cabecera = request.headers.get("authorization");
  if (!cabecera?.startsWith("Basic ")) return null;
  try {
    const texto = atob(cabecera.slice(6));
    const separador = texto.indexOf(":");
    if (separador === -1) return null;
    return [texto.slice(0, separador), texto.slice(separador + 1)];
  } catch {
    return null;
  }
}

/**
 * Protege toda la app (páginas y API) con usuario y contraseña del navegador
 * (HTTP Basic). Se activa al definir AUTH_PASSWORD; sin ella la app queda abierta,
 * como en desarrollo local.
 */
export function proxy(request: NextRequest) {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return NextResponse.next();

  const usuario = process.env.AUTH_USER || "admin";
  const recibidas = credenciales(request);
  if (recibidas && iguales(recibidas[0], usuario) && iguales(recibidas[1], password)) {
    return NextResponse.next();
  }

  return new NextResponse("Se necesita usuario y contraseña", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Extracto", charset="UTF-8"' },
  });
}

export const config = {
  // Todo menos los archivos estáticos del build, que no contienen datos
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
