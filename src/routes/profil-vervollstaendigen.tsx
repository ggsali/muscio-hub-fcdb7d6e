import { createFileRoute } from "@tanstack/react-router";
import CompleteProfile from "@/pages/kunde/CompleteProfile";

export const Route = createFileRoute("/profil-vervollstaendigen")({
  component: CompleteProfile,
});
