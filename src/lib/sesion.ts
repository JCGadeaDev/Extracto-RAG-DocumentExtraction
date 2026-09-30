import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "extracto_sesion";
export const DURACION_SESION_S = 7 * 24 * 60 * 60;

/** Usuario y contraseña configurados; null si la app no está protegida. */
export function credencialesConfiguradas(): { usuario: string; password: string } | null {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return null;
  return { usuario: process.env.AUTH_USER || "admin", password };
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function credencialesValidas(usuario: string, password: string): boolean {
  const esperadas = credencialesConfiguradas();
  if (!esperadas) return false;
  // Se comparan las dos siempre, para no revelar cuál de ellas falla
  const usuarioOk = iguales(usuario, esperadas.usuario);
  const passwordOk = iguales(password, esperadas.password);
  return usuarioOk && passwordOk;
}

// La clave de firma sale de la contraseña: al cambiarla se invalidan todas las
// sesiones abiertas, sin otra variable de entorno que mantener
function firmar(caducidad: number, password: string): string {
  return createHmac("sha256", `extracto-sesion:${password}`)
    .update(String(caducidad))
    .digest("base64url");
}

/** Valor de la cookie de sesión: "<caducidad en segundos>.<firma>". */
export function crearSesion(ahora = Date.now()): string {
  const esperadas = credencialesConfiguradas();
  if (!esperadas) throw new Error("Falta AUTH_PASSWORD");
  const caducidad = Math.floor(ahora / 1000) + DURACION_SESION_S;
  return `${caducidad}.${firmar(caducidad, esperadas.password)}`;
}

export function sesionValida(valor: string | undefined, ahora = Date.now()): boolean {
  const esperadas = credencialesConfiguradas();
  if (!esperadas || !valor) return false;

  const [textoCaducidad, firma] = valor.split(".");
  const caducidad = Number(textoCaducidad);
  if (!Number.isInteger(caducidad) || !firma) return false;
  if (caducidad < Math.floor(ahora / 1000)) return false;
  return iguales(firma, firmar(caducidad, esperadas.password));
}

/** Solo rutas internas, para que ?next= no sirva para redirigir a otro sitio. */
export function destinoSeguro(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/";
}
