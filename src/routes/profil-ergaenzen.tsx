import { createFileRoute } from "@tanstack/react-router";
import ProfilErgaenzenPage from "@/pages/site/ProfilErgaenzenPage";

export const Route = createFileRoute("/profil-ergaenzen")({
  component: ProfilErgaenzenPage,
});
