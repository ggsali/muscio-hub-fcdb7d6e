import { createFileRoute } from "@tanstack/react-router";
import RentabilitaetPage from "@/pages/RentabilitaetPage";

export const Route = createFileRoute("/admin/rentabilitaet")({
  component: RentabilitaetPage,
});
