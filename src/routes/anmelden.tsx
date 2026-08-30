import { createFileRoute } from "@tanstack/react-router";
import KundeLogin from "@/pages/kunde/Login";

export const Route = createFileRoute("/anmelden")({
  component: KundeLogin,
});
