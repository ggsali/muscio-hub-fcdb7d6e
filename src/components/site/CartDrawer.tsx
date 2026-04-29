import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Trash2, Plus, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SHIPPING_FREE_FROM = 65;
const SHIPPING_COST = 8;
const MWST = 0.081;
const CHF = (n: number) => `CHF ${n.toFixed(2)}`;

export function CartDrawer() {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, subtotal, clear } = useCart();
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", postal_code: "", city: "", country: "Schweiz",
  });

  const shipping = subtotal === 0 ? 0 : (subtotal >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST);
  const beforeMwst = subtotal + shipping;
  const mwst = beforeMwst * MWST;
  const total = beforeMwst + mwst;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-shop-checkout", {
        body: {
          items: items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, preis: i.preis })),
          customer: form,
          totals: { subtotal, shipping, mwst, total },
          successUrl: `${window.location.origin}/payment-success`,
          cancelUrl: `${window.location.origin}/shop`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        clear();
        window.location.href = data.url;
      } else {
        throw new Error("Kein Checkout-Link erhalten");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Fehler beim Checkout");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) setStep("cart"); }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{step === "cart" ? "Warenkorb" : "Bestelldaten"}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Dein Warenkorb ist leer</p>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Weiter einkaufen</Button>
          </div>
        ) : step === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map(it => (
                <div key={it.productId} className="flex gap-3 p-3 bg-card border border-border rounded-xl">
                  {it.image && <img src={it.image} alt={it.name} className="w-16 h-16 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{CHF(it.preis)}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => updateQuantity(it.productId, it.quantity - 1)}
                        className="w-7 h-7 rounded border border-input flex items-center justify-center hover:bg-muted">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{it.quantity}</span>
                      <button onClick={() => updateQuantity(it.productId, it.quantity + 1)}
                        className="w-7 h-7 rounded border border-input flex items-center justify-center hover:bg-muted">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeItem(it.productId)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold">{CHF(it.preis * it.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span>{CHF(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Versand</span><span>{shipping === 0 ? "Gratis" : CHF(shipping)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">MwSt. (8.1%)</span><span>{CHF(mwst)}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span><span className="text-primary">{CHF(total)}</span>
              </div>
              <Button className="w-full mt-3" onClick={() => setStep("checkout")}>Zur Kasse</Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCheckout} className="flex-1 overflow-y-auto space-y-3 py-4">
            <div><Label className="text-xs">Name *</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">E-Mail *</Label><Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Adresse *</Label><Input required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">PLZ *</Label><Input required value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Ort *</Label><Input required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Land *</Label><Input required value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="mt-1" /></div>

            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{CHF(total)}</span></div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep("cart")} className="flex-1">Zurück</Button>
              <Button type="submit" disabled={submitting} className="flex-1 gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Lädt…</> : "Zur Zahlung"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
