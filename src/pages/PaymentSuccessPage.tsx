import { useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import successImg from "@/assets/payment-success.png";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const cleared = useRef(false);
  const orderNr = params.get("order_id")?.slice(0, 8).toUpperCase();
  const sessionId = params.get("session_id")?.slice(0, 16);

  // Nach erfolgreicher Zahlung Warenkorb leeren (nur einmal)
  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    clearCart();
    window.scrollTo({ top: 0 });
  }, [clearCart]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6 py-16">
        <img
          src={successImg}
          alt="Bezahlt"
          className="w-32 h-32 mx-auto drop-shadow-lg animate-bounce-once"
        />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Zahlung erfolgreich! 🎉</h1>
          {orderNr && (
            <p className="text-sm text-muted-foreground">Auftrag Nr. {orderNr}</p>
          )}
          {sessionId && !orderNr && (
            <p className="text-sm text-muted-foreground">Session: {sessionId}...</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-2 shadow-sm">
          <p className="text-foreground font-medium">Vielen Dank für Ihre Zahlung!</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ihre Zahlung wurde erfolgreich verarbeitet. Sie erhalten in Kürze eine Bestätigung per E-Mail.
            Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/shop">Weiter einkaufen</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/portal/bestellungen">Meine Bestellungen</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Diese Seite kann geschlossen werden.
        </p>
      </div>
    </div>
  );
}
