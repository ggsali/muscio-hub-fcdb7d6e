import { Outlet } from "react-router-dom";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";
import { CartProvider } from "@/contexts/CartContext";
import { CartDrawer } from "./site/CartDrawer";

export default function SiteLayout() {
  return (
    <CartProvider>
      <div className="site-theme min-h-screen flex flex-col">
        <CursorSpotlight />
        <CanonicalTag />
        <Header />
        <main className="flex-1 pt-14">
          <Outlet />
        </main>
        <Footer />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
