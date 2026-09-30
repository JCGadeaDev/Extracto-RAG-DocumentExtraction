import { NextResponse } from "next/server";
import {
  COOKIE_SESION,
  DURACION_SESION_S,
  crearSesion,
  credencialesValidas,
  destinoSeguro,
} from "@/lib/sesion";

// Redirección relativa: detrás del balanceador request.url es http y con el
// puerto interno. 303 hace que el navegador pase a GET tras el POST.
function redirigir(ruta: string) {
  return new NextResponse(null, { status: 303, headers: { Location: ruta } });
}

function esHttps(request: Request): boolean {
  const reenviado = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return (reenviado ?? new URL(request.url).protocol.replace(":", "")) === "https";
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
    return redirigir(`/login?${params}`);
  }

  const res = redirigir(next);
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
