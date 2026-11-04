import { createFileRoute } from "@tanstack/react-router";
import LaborLayout from "@/components/LaborLayout";

export const Route = createFileRoute("/labor")({
  component: () => <LaborLayout />,
});
