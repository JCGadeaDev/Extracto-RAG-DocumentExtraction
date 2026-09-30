import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/sesion";

export const metadata: Metadata = { title: "Entrar · Extracto" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Extracto</h1>
        <p className="mt-1 text-zinc-500">Inicia sesión para continuar.</p>
      </header>

      <form method="post" action="/api/login" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={destinoSeguro(next)} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Usuario
          <input
            name="usuario"
            autoComplete="username"
            required
            defaultValue="admin"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-normal outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-normal outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Usuario o contraseña incorrectos.
          </p>
        )}

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
