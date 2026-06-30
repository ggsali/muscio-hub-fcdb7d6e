import { useState, useCallback } from "react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface CheckoutItem {
  product_id: string;
  name: string;
  preis: number;
  quantity: number;
  slug: string;
}

interface CheckoutCustomer {
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

interface CheckoutOptions {
  items: CheckoutItem[];
  customer?: CheckoutCustomer;
  userId?: string;
  returnUrl?: string;
  onError?: (message: string) => void;
}

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);

  const openCheckout = useCallback((opts: CheckoutOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const checkoutElement = isOpen && options && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          onClick={closeCheckout}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Schliessen"
        >
          ✕
        </button>
        <h2 className="text-lg font-bold mb-4">Zur Kasse</h2>
        <StripeEmbeddedCheckout {...options} />
      </div>
    </div>
  );

  return { openCheckout, closeCheckout, isOpen, checkoutElement };
}
