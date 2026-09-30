import type { Metadata } from "next";
import { CircleAlert, LogIn } from "lucide-react";
import { claseBoton } from "@/components/ui";
import { destinoSeguro } from "@/lib/sesion";

export const metadata: Metadata = { title: "Entrar" };

const CAMPO =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink shadow-sm outline-none transition-[border-color,box-shadow] duration-150 hover:border-muted focus:border-accent focus:ring-3 focus:ring-accent/20";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg viewBox="0 0 24 24" className="size-10" aria-hidden>
            <rect x="3" y="2" width="14" height="18" rx="2.5" fill="var(--accent)" />
            <rect x="7" y="4" width="14" height="18" rx="2.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M10 10h8M10 13.5h8M10 17h5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Entrar en Extracto</h1>
            <p className="text-muted">Extracción y revisión de documentos con IA</p>
          </div>
        </div>

        <form
          method="post"
          action="/api/login"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-md"
        >
          <input type="hidden" name="next" value={destinoSeguro(next)} />

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Usuario o contraseña incorrectos. Inténtalo de nuevo.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="usuario" className="text-[13px] font-medium text-ink-2">
              Usuario
            </label>
            <input id="usuario" name="usuario" autoComplete="username" required defaultValue="admin" className={CAMPO} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-ink-2">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={Boolean(error)}
              className={CAMPO}
            />
          </div>

          <button type="submit" className={`${claseBoton("primario")} mt-1 h-10 w-full`}>
            <LogIn aria-hidden />
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
