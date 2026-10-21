import { Outlet } from "@/lib/router-compat";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";
import { CartDrawer } from "./site/CartDrawer";
import { ChatWidget } from "./site/ChatWidget";
import { ChatFab } from "./site/ChatFab";
import { MobileStickyCta } from "./site/MobileStickyCta";
import { CartProvider } from "@/contexts/CartContext";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePageViewTracker } from "@/hooks/usePageViewTracker";
import { useChristmasMode } from "@/hooks/useChristmasMode";
import { Snowfall } from "./site/Snowfall";
import { SnowPath } from "./site/SnowPath";
import { SnowDrift, Snowman } from "./site/XmasDecor";
import { Link } from "@/lib/router-compat";

export default function SiteLayout() {
  usePageViewTracker();
  const xmas = useChristmasMode();
  return (
    <CartProvider>
      <div className={`site-theme min-h-screen flex flex-col${xmas ? " xmas" : ""}`}>
        {xmas && <Snowfall />}
        {xmas && <Snowman />}
        {xmas && <SnowPath />}
        <PaymentTestModeBanner />
        <CursorSpotlight />
        <CanonicalTag />
        {/* Sticky stack: Banner sits above the header — they no longer overlap */}
        <div className="sticky top-0 z-50">
          {xmas && <SnowDrift />}
          <Header />
          {xmas && (
            <div className="xmas-strip">
              <Link to="/weihnachtsgeschenke">❄ Weihnachtszeit: persönliche Geschenke aus dem 3D-Drucker – jetzt rechtzeitig bestellen →</Link>
            </div>
          )}
        </div>
        <CartDrawer />
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
        <Footer />
        <ChatWidget />
        <ChatFab />
        <MobileStickyCta />
      </div>
    </CartProvider>
  );
}

