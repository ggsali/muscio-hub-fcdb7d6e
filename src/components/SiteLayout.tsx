import { Outlet } from "react-router-dom";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";
import { CartDrawer } from "./site/CartDrawer";
import { ShopPromoBanner } from "./site/ShopPromoBanner";
import { ChatWidget } from "./site/ChatWidget";
import { CartProvider } from "@/contexts/CartContext";
import { MessageCircle } from "lucide-react";

export default function SiteLayout() {
  return (
    <CartProvider>
      <div className="site-theme min-h-screen flex flex-col">
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
        <a
          href="https://wa.me/41798395080"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp Kontakt"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        >
          <MessageCircle className="w-7 h-7" />
        </a>
      </div>
    </CartProvider>
  );
}
