import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import Nav from "@/components/nav";
import { credencialesConfiguradas } from "@/lib/sesion";

// El botón Salir depende de AUTH_PASSWORD, que se lee al servir y no al compilar
export const dynamic = "force-dynamic";

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="3" y="2" width="14" height="18" rx="2.5" fill="var(--accent)" />
        <rect x="7" y="4" width="14" height="18" rx="2.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M10 10h8M10 13.5h8M10 17h5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] max-sm:sr-only">Extracto</span>
    </Link>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Marca />
          <div className="h-full min-w-0 flex-1">
            <Nav />
          </div>
          {credencialesConfiguradas() && <LogoutButton />}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
