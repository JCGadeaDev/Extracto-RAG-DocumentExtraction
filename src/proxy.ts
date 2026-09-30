import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_SESION,
  credencialesConfiguradas,
  credencialesValidas,
  sesionValida,
} from "@/lib/sesion";

// Accesibles sin sesión: la propia página de acceso y su API
const PUBLICAS = ["/login", "/api/login"];

/** Credenciales HTTP Basic, para usar la API desde scripts o curl. */
function basicValida(request: NextRequest): boolean {
  const cabecera = request.headers.get("authorization");
  if (!cabecera?.startsWith("Basic ")) return false;
  try {
    const texto = atob(cabecera.slice(6));
    const separador = texto.indexOf(":");
    return (
      separador !== -1 &&
      credencialesValidas(texto.slice(0, separador), texto.slice(separador + 1))
    );
  } catch {
    return false;
  }
}

/**
 * Protege toda la app (páginas y API) cuando se define AUTH_PASSWORD; sin ella
 * queda abierta, como en desarrollo local. En el navegador se entra por /login
 * (cookie de sesión firmada); desde scripts vale también HTTP Basic.
 */
export function proxy(request: NextRequest) {
  if (!credencialesConfiguradas()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();

  if (
    sesionValida(request.cookies.get(COOKIE_SESION)?.value) ||
    basicValida(request)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Inicia sesión para continuar" }, { status: 401 });
  }
  // Relativa, por el mismo motivo que en /api/login
  const destino = pathname === "/" ? "" : `?${new URLSearchParams({ next: pathname + search })}`;
  return new NextResponse(null, { status: 307, headers: { Location: `/login${destino}` } });
}

export const config = {
  // Todo menos los archivos estáticos del build, que no contienen datos
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
