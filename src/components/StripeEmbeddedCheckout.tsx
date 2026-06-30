import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface StripeEmbeddedCheckoutProps {
  items: Array<{
    product_id: string;
    name: string;
    preis: number;
    quantity: number;
    slug: string;
  }>;
  customer?: {
    email: string;
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  userId?: string;
  returnUrl?: string;
  onError?: (message: string) => void;
}

export function StripeEmbeddedCheckout({
  items,
  customer,
  userId,
  returnUrl,
  onError,
}: StripeEmbeddedCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-shop-checkout", {
      body: {
        items,
        customer,
        userId,
        environment: getStripeEnvironment(),
        returnUrl: returnUrl || `${window.location.origin}/payment-success`,
      },
    });
    if (error || !data?.clientSecret) {
      const message = error?.message || data?.error || "Checkout konnte nicht gestartet werden";
      onError?.(message);
      throw new Error(message);
    }
    return data.clientSecret;
  };

  return (
    <div className="w-full min-h-[500px]">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
