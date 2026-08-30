import { createFileRoute } from "@tanstack/react-router";
import KundeRegister from "@/pages/kunde/Register";

export const Route = createFileRoute("/registrieren")({
  component: KundeRegister,
});
