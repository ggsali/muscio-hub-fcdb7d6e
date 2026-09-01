import { Link, useNavigate } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Minus, Plus, ShoppingBag, Trash2, ShoppingCart, Ticket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { pruefeGutschein, berechneRabatt, gutscheinWertLabel, type Gutschein } from "@/lib/gutschein";

const RESUME_CHECKOUT_KEY = "muscio_resume_checkout";

export const CartDrawer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCustomerAuth();
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalPrice, totalItems, clearCart } = useCart();
  const { openCheckout, checkoutElement } = useStripeCheckout();
  const [codeInput, setCodeInput] = useState("");
  const [gutschein, setGutschein] = useState<Gutschein | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const rabatt = gutschein ? berechneRabatt(gutschein, totalPrice).rabatt : 0;
  const endTotal = Math.max(totalPrice - rabatt, 0);

  // Gutschein verwerfen, wenn der Warenkorb geändert wird (z. B. Mindestbestellwert
  // nicht mehr erreicht) – sonst scheitert der Checkout serverseitig.
  useEffect(() => {
    if (!gutschein) return;
    const mindest = Number(gutschein.mindestbestellwert || 0);
    if (items.length === 0 || (mindest > 0 && totalPrice < mindest)) {
      setGutschein(null);
      setCodeInput("");
      if (items.length > 0) {
        toast({
          title: "Gutschein entfernt",
          description: `Mindestbestellwert CHF ${mindest.toFixed(2)} nicht mehr erreicht.`,
        });
      }
    }
  }, [items, totalPrice, gutschein, toast]);

  const applyCode = async () => {
    setCheckingCode(true);
    const res = await pruefeGutschein(codeInput, totalPrice);
    setCheckingCode(false);
    if (!res.ok) {
      setGutschein(null);
      toast({ title: "Gutschein ungültig", description: res.error, variant: "destructive" });
      return;
    }
    setGutschein(res.gutschein);
    toast({ title: "Gutschein aktiviert", description: `${res.gutschein.code} · ${gutscheinWertLabel(res.gutschein)}` });
  };



  const handleCheckout = useCallback(async () => {
    if (items.length === 0) return;

    // Nicht angemeldet → zur Anmeldung, Checkout nach Login fortsetzen
    if (!user) {
      try { sessionStorage.setItem(RESUME_CHECKOUT_KEY, "1"); } catch {}
      setIsOpen(false);
      toast({
        title: "Bitte anmelden",
        description: "Melde dich an oder registriere dich, um die Bestellung abzuschliessen.",
      });
      navigate("/anmelden");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, address, city, postal_code, country")
      .eq("user_id", user.id)
      .maybeSingle();

    openCheckout({
      items: items.map((i) => ({
        product_id: i.productId,
        name: i.name,
        preis: i.preis,
        quantity: i.quantity,
        slug: i.slug,
        optionen: (i.optionen || []).map((o) => ({
          optionId: o.optionId,
          optionName: o.optionName,
          wertId: o.wertId,
          wertName: o.wertName,
        })),
      })),
      customer: profile
        ? {
            email: user.email ?? "",
            name: profile.full_name || "",
            phone: profile.phone || "",
            address: profile.address || "",
            city: profile.city || "",
            postal_code: profile.postal_code || "",
            country: profile.country || "Schweiz",
          }
        : { email: user.email ?? "" },
      userId: user.id,
      returnUrl: `${window.location.origin}/payment-success`,
      gutscheinCode: gutschein?.code,
      onError: (message) => {
        if (/gutschein/i.test(message)) {
          setGutschein(null);
          setCodeInput("");
          toast({
            title: "Gutschein nicht einlösbar",
            description: `${message} – der Code wurde entfernt, bitte erneut zur Kasse gehen.`,
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Checkout fehlgeschlagen", description: message, variant: "destructive" });
      },
    });
    setIsOpen(false);
  }, [items, user, navigate, setIsOpen, toast, openCheckout, gutschein]);

  // Nach Login automatisch Checkout fortsetzen
  useEffect(() => {
    if (!user) return;
    let pending = false;
    try { pending = sessionStorage.getItem(RESUME_CHECKOUT_KEY) === "1"; } catch {}
    if (pending && items.length > 0) {
      try { sessionStorage.removeItem(RESUME_CHECKOUT_KEY); } catch {}
      setIsOpen(true);
      handleCheckout();
    }
  }, [user, items.length, handleCheckout, setIsOpen]);

  return (
    <>
      {/* Checkout-Modal ausserhalb des Drawers rendern, damit es beim Schliessen
          des Warenkorbs nicht sofort wieder unmountet wird. */}
      {checkoutElement}
      <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span className="font-heading font-bold text-foreground">Warenkorb</span>
                {totalItems > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalItems}
                  </span>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                  <div>
                    <p className="font-medium text-foreground">Dein Warenkorb ist leer</p>
                    <p className="text-xs text-muted-foreground mt-1">Füge Produkte hinzu</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setIsOpen(false); navigate("/shop"); }}>
                    Zum Shop
                  </Button>
                </div>
              ) : (
                items.map(item => (
                  <motion.div
                    key={item.id} layout
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex gap-3 bg-muted/30 rounded-xl p-3 border border-border"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/shop/${item.slug}`} onClick={() => setIsOpen(false)}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                        {item.name}
                      </Link>
                      {item.optionen && item.optionen.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {item.optionen.map(o => (
                            <p key={o.optionId} className="text-xs text-muted-foreground">
                              {o.optionName}: {o.wertName}
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-bold text-primary mt-0.5">CHF {(item.preis * item.quantity).toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-border rounded-lg overflow-hidden">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold border-x border-border">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </motion.div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Zwischensumme</span>
                  <span className="font-bold text-foreground text-lg">CHF {totalPrice.toFixed(2)}</span>
                </div>
                {gutschein && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-success flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5" /> {gutschein.code}
                    </span>
                    <span className="text-success font-semibold">
                      {gutschein.typ === "gratis_versand" ? "Gratis Versand" : `− CHF ${rabatt.toFixed(2)}`}
                    </span>
                  </div>
                )}
                {gutschein && gutschein.typ !== "gratis_versand" && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold text-primary text-lg">CHF {endTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="Gutschein-Code"
                    className="h-9 text-sm"
                  />
                  {gutschein ? (
                    <Button variant="outline" size="sm" className="h-9" onClick={() => { setGutschein(null); setCodeInput(""); }}>
                      Entfernen
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9" onClick={applyCode} disabled={checkingCode || !codeInput.trim()}>
                      {checkingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Einlösen"}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Versand wird im Checkout berechnet.</p>
                <Button className="w-full gap-2" onClick={handleCheckout}>
                  <ShoppingCart className="w-4 h-4" />
                  Zur Kasse
                </Button>
                <button onClick={clearCart} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1">
                  Warenkorb leeren
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </>
  );
};
