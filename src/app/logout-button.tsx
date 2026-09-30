"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function salir() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <button
      onClick={salir}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      Salir
    </button>
  );
}
