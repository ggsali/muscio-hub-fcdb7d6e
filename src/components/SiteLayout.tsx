import { Outlet } from "react-router-dom";
import { Header } from "./site/Header";
import { Footer } from "./site/Footer";
import { CursorSpotlight } from "./site/CursorSpotlight";
import { CanonicalTag } from "./site/CanonicalTag";

export default function SiteLayout() {
  return (
    <div className="site-theme min-h-screen flex flex-col">
      <CursorSpotlight />
      <CanonicalTag />
      <Header />
      <main className="flex-1 pt-14">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
