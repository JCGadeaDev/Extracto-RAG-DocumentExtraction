import { credencialesConfiguradas } from "@/lib/sesion";
import Chat from "./chat";
import LogoutButton from "./logout-button";
import Uploader from "./uploader";

// Depende de AUTH_PASSWORD, que se lee al servir la página y no al compilar
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Extracto</h1>
          <p className="mt-1 text-zinc-500">
            Sube una factura, recibo o contrato y pulsa Analizar para extraer
            sus datos en JSON.
          </p>
        </div>
        {credencialesConfiguradas() && <LogoutButton />}
      </header>
      <Uploader />
      <Chat />
    </main>
  );
}
