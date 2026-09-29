import Chat from "./chat";
import Uploader from "./uploader";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Extracto</h1>
        <p className="mt-1 text-zinc-500">
          Sube una factura, recibo o contrato y pulsa Analizar para extraer
          sus datos en JSON.
        </p>
      </header>
      <Uploader />
      <Chat />
    </main>
  );
}
