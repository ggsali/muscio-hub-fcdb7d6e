import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { X, Minus, Plus, ShoppingBag, Trash2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

const RESUME_CHECKOUT_KEY = "muscio_resume_checkout";

export const CartDrawer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCustomerAuth();
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalPrice, totalItems, clearCart } = useCart();
  const { openCheckout, checkoutElement } = useStripeCheckout();

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
      })),
      customer: profile
        ? {
            email: user.email,
            name: profile.full_name || "",
            phone: profile.phone || "",
            address: profile.address || "",
            city: profile.city || "",
            postal_code: profile.postal_code || "",
            country: profile.country || "Schweiz",
          }
        : { email: user.email },
      userId: user.id,
      returnUrl: `${window.location.origin}/payment-success`,
      onError: (message) => {
        toast({ title: "Checkout fehlgeschlagen", description: message, variant: "destructive" });
      },
    });
    setIsOpen(false);
  }, [items, user, navigate, setIsOpen, toast, openCheckout]);

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
                      <p className="text-sm font-bold text-primary mt-0.5">CHF {(item.preis * item.quantity).toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-border rounded-lg overflow-hidden">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-2 py-1 hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold border-x border-border">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-2 py-1 hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button onClick={() => removeItem(item.productId)} className="p-1 text-muted-foreground hover:text-destructive">
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
  );
};
