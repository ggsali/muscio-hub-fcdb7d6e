import { createFileRoute } from "@tanstack/react-router";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";

export const Route = createFileRoute("/payment-success")({
  component: PaymentSuccessPage,
});
