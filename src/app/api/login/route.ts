import { NextResponse } from "next/server";
import {
  COOKIE_SESION,
  DURACION_SESION_S,
  crearSesion,
  credencialesValidas,
  destinoSeguro,
} from "@/lib/sesion";
import { esHttps, urlPublica } from "@/lib/url-publica";

// 303: el navegador pasa a GET tras el POST del formulario
function redirigir(request: Request, ruta: string) {
  return NextResponse.redirect(urlPublica(request, ruta), 303);
}

/** Recibe el formulario de /login y abre la sesión. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const usuario = String(form?.get("usuario") ?? "");
  const password = String(form?.get("password") ?? "");
  const next = destinoSeguro(form?.get("next")?.toString());

  if (!credencialesValidas(usuario, password)) {
    const params = new URLSearchParams({ error: "1" });
    if (next !== "/") params.set("next", next);
    return redirigir(request, `/login?${params}`);
  }

  const res = redirigir(request, next);
  res.cookies.set(COOKIE_SESION, crearSesion(), {
    httpOnly: true,
    secure: esHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_S,
  });
  return res;
}

/** Cierra la sesión (lo usa el enlace "Salir"). */
export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
