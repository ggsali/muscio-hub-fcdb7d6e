import { Outlet } from "react-router-dom";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";
import { CartDrawer } from "./site/CartDrawer";
import { ShopPromoBanner } from "./site/ShopPromoBanner";
import { ChatWidget } from "./site/ChatWidget";
import { ChatFab } from "./site/ChatFab";
import { CartProvider } from "@/contexts/CartContext";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePageViewTracker } from "@/hooks/usePageViewTracker";

export default function SiteLayout() {
  usePageViewTracker();
  return (
    <CartProvider>
      <div className="site-theme min-h-screen flex flex-col">
        <PaymentTestModeBanner />
        <CursorSpotlight />
        <CanonicalTag />
        {/* Sticky stack: Banner sits above the header — they no longer overlap */}
        <div className="sticky top-0 z-50">
          <ShopPromoBanner />
          <Header />
        </div>
        <CartDrawer />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <ChatWidget />
        <ChatFab />
      </div>
    </CartProvider>
  );
}
