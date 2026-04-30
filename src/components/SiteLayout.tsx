import { Outlet } from "react-router-dom";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";
import { CartDrawer } from "./site/CartDrawer";
import { ShopPromoBanner } from "./site/ShopPromoBanner";
import { ChatWidget } from "./site/ChatWidget";
import { CartProvider } from "@/contexts/CartContext";

export default function SiteLayout() {
  return (
    <CartProvider>
      <div className="site-theme min-h-screen flex flex-col">
        <CursorSpotlight />
        <CanonicalTag />
        <ShopPromoBanner />
        <Header />
        <CartDrawer />
        <main className="flex-1 pt-14">
          <Outlet />
        </main>
        <Footer />
        <ChatWidget />
      </div>
    </CartProvider>
  );
}
