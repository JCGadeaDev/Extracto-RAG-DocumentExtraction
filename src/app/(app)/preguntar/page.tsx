import type { Metadata } from "next";
import Chat from "@/components/chat";

export const metadata: Metadata = { title: "Preguntar" };

export default function Preguntar() {
  return <Chat />;
}
