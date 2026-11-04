import { createFileRoute } from "@tanstack/react-router";
import AdminGate from "@/components/AdminGate";
import LaborLayout from "@/components/LaborLayout";

// Getrennter Entwickler-Bereich: gleiche Zugangspruefung wie /admin (Admin-Rolle + 2FA),
// aber eigenes Layout ohne Verbindung zu Kunden, Auftraegen und Rechnungen.
export const Route = createFileRoute("/labor")({
  component: () => <AdminGate Layout={LaborLayout} />,
});
