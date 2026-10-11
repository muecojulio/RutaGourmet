import { createFileRoute } from "@tanstack/react-router";
import { RutaApp } from "@/components/ruta-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <RutaApp />;
}
