"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Boton } from "./ui";

export default function LogoutButton() {
  const router = useRouter();

  async function salir() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <Boton variante="fantasma" tamano="sm" onClick={salir}>
      <LogOut aria-hidden />
      <span className="max-sm:sr-only">Salir</span>
    </Boton>
  );
}
