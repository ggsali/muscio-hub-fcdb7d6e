import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Menu, X, Printer, User, ShoppingCart, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";
import { useResinEnabled, isResinText } from "@/hooks/useResinEnabled";
import type { Session } from "@supabase/supabase-js";

interface NavChild { label: string; path: string; divider?: boolean; }
interface NavItem { label: string; path: string; children?: NavChild[]; isButton?: boolean; }

const NAV_ITEMS: NavItem[] = [
  { label: "Kalkulator", path: "/kalkulator-online", isButton: true },
  {
    label: "Leistungen",
    path: "/leistungen",
    children: [
      { label: "FDM 3D-Druck", path: "/leistungen/fdm-3d-druck" },
      { label: "SLA Resin Druck", path: "/leistungen/sla-3d-druck" },
      { label: "Prototypen", path: "/leistungen/3d-druck-prototypen" },
      { label: "Ersatzteile", path: "/leistungen/3d-druck-ersatzteile" },
      { label: "Kleinserien", path: "/leistungen/3d-druck-kleinserien" },
      { label: "3D-Druck Schweiz", path: "/3d-druck-schweiz" },
    ],
  },
  { label: "Materialien", path: "/materialien" },
  { label: "Shop", path: "/shop" },
  { label: "Projekte", path: "/projekte" },
  { label: "Blog", path: "/blog" },
  {
    label: "Über uns",
    path: "/ueber-uns",
    children: [
      { label: "Über 3DMuscio", path: "/ueber-uns" },
      { label: "Kontakt", path: "/kontakt" },
    ],
  },
];

const flattenNav = (items: NavItem[]): NavChild[] =>
  items.flatMap((l) => {
    if (l.children && l.children.length > 0) return l.children.filter((c) => !c.divider);
    return [{ label: l.label, path: l.path }];
  });

const isExternal = (path: string) => /^https?:\/\//.test(path);

// Interne Links über den Router, externe über <a href> (Admin erlaubt beides).
const NavEntry = ({ to, className, children, onClick }: {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) =>
  isExternal(to) ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className} onClick={onClick}>
      {children}
    </Link>
  );

export const Header = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimer = useRef<number | null>(null);
  const { totalItems, setIsOpen: setCartOpen } = useCart();
  const [navItems, setNavItems] = useState<NavItem[]>(NAV_ITEMS);
  const resin = useResinEnabled();

  // Resin ausgeschaltet: Resin-Einträge (auch aus der Admin-Navigation) verbergen.
  const visibleNav: NavItem[] = resin
    ? navItems
    : navItems
        .map((l) => ({
          ...l,
          children: l.children?.filter((c) => !isResinText(c.label) && !isResinText(c.path)),
        }))
        .filter((l) => !isResinText(l.label) && !isResinText(l.path));

  useEffect(() => { setOpen(false); setOpenDropdown(null); }, [location.pathname]);

  // Vom Admin gespeicherte Navigation (website_settings.nav_links) übernimmt,
  // sofern vorhanden – sonst bleibt die Standard-Navigation aktiv.
  useEffect(() => {
    let active = true;
    supabase
      .from("website_settings")
      .select("value")
      .eq("key", "nav_links")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const v = (data as any)?.value;
        if (!Array.isArray(v) || v.length === 0) return;
        const items: NavItem[] = v
          .filter((i: any) => i && typeof i.label === "string" && typeof i.path === "string" && i.label.trim() && i.path.trim())
          .map((i: any) => ({
            label: String(i.label),
            path: String(i.path),
            isButton: Boolean(i.isButton),
            children: Array.isArray(i.children)
              ? i.children
                  .filter((c: any) => c && c.label && c.path)
                  .map((c: any) => ({ label: String(c.label), path: String(c.path) }))
              : undefined,
          }));
        if (items.length > 0) setNavItems(items);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accountTarget = "/portal";
  const accountLabel = "Mein Konto";

  const handleEnter = (path: string) => {
    if (dropdownTimer.current) window.clearTimeout(dropdownTimer.current);
    setOpenDropdown(path);
  };
  const handleLeave = () => {
    if (dropdownTimer.current) window.clearTimeout(dropdownTimer.current);
    dropdownTimer.current = window.setTimeout(() => setOpenDropdown(null), 300);
  };

  return (
    <>
      <motion.header
        className="relative w-full px-3 pb-2 pt-2 sm:px-6 sm:pt-3"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between rounded-full border px-3 sm:px-5",
            "bg-background/80 backdrop-blur-xl transition-all duration-300",
            scrolled || open
              ? "h-12 border-border bg-background/95 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)]"
              : "h-14 border-border/60 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.25)]"
          )}
        >

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src={logo}
              alt="3DMuscio 3D-Druck Schweiz"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <div className="flex flex-col leading-none">
              <span className="font-heading text-[14px] font-extrabold tracking-tight text-foreground">
                3D<span className="text-primary">Muscio</span>
              </span>
              <span className="text-[8px] uppercase tracking-[0.2em] font-medium hidden sm:block text-muted-foreground">
                3D-Druck Schweiz
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {visibleNav.map((l) => {
              const active = location.pathname === l.path;
              const hasChildren = l.children && l.children.length > 0;
              return (
                <div
                  key={l.path}
                  className="relative"
                  onMouseEnter={() => hasChildren && handleEnter(l.path)}
                  onMouseLeave={() => hasChildren && handleLeave()}
                >
                  {l.isButton ? (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className={cn(
                        "rounded-full h-8 px-4 text-sm font-semibold border-transparent bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors",
                        active && "bg-primary/20"
                      )}
                    >
                      <NavEntry to={l.path}>{l.label}</NavEntry>
                    </Button>
                  ) : (
                    <NavEntry
                      to={l.path}
                      className={cn(
                        "relative flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors group",
                        active ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <span className={cn(
                        "transition-colors duration-150",
                        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {l.label}
                      </span>
                      {hasChildren && (
                        <ChevronDown className={cn(
                          "w-3 h-3 transition-transform duration-200",
                          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                          openDropdown === l.path && "rotate-180"
                        )} />
                      )}
                    </NavEntry>
                  )}

                  <AnimatePresence>
                    {hasChildren && openDropdown === l.path && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50 min-w-[200px]"
                      >
                        <div className="bg-popover border border-border rounded-2xl shadow-xl p-1.5">
                          {l.children!.map((c, idx) =>
                            c.divider ? (
                              <hr key={`divider-${idx}`} className="my-1 border-border" />
                            ) : (
                              <NavEntry
                                key={c.path}
                                to={c.path}
                                onClick={() => setOpenDropdown(null)}
                                className="block px-3 py-2 text-sm rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                              >
                                {c.label}
                              </NavEntry>
                            )
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Warenkorb"
            >
              <ShoppingCart className="w-4 h-4 text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            {session ? (
              <Button variant="ghost" size="sm" asChild
                className="rounded-full h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent">
                <Link to={accountTarget}><User className="w-3.5 h-3.5 mr-1" />{accountLabel}</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild
                className="rounded-full h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent">
                <Link to="/anmelden">Anmelden</Link>
              </Button>
            )}
            <Button variant="default" size="sm" asChild
              className="rounded-full h-9 px-5 text-sm font-semibold shadow-sm">
              <Link to="/kalkulator-online">
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Preis berechnen
              </Link>
            </Button>
          </div>

          <div className="lg:hidden flex items-center gap-1.5">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="Warenkorb"
            >
              <ShoppingCart className="w-4 h-4 text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-3.5 min-w-3.5 px-1 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            {session ? (
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 rounded-full text-muted-foreground">
                <Link to={accountTarget}><User className="w-4 h-4" /></Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild className="h-8 px-3 text-xs rounded-full text-muted-foreground">
                <Link to="/anmelden">Anmelden</Link>
              </Button>
            )}
            <button
              className="p-1.5 rounded-md bg-black/5 hover:bg-black/10 transition-colors"
              onClick={() => setOpen(!open)}
              aria-label="Menü"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={open ? "x" : "m"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {open ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              className="lg:hidden absolute left-3 right-3 sm:left-6 sm:right-6 top-full z-40 rounded-3xl bg-foreground/95 backdrop-blur-xl border border-white/10 shadow-2xl max-h-[calc(100vh-7rem)] overflow-y-auto"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <nav className="flex flex-col p-3 gap-0.5">
                {flattenNav(visibleNav).map((l: NavChild, i: number) => {
                  const active = location.pathname === l.path || location.pathname + location.hash === l.path;
                  return (
                    <motion.div key={l.path} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <NavEntry
                        to={l.path}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-colors",
                          active
                            ? "text-white bg-white/10 font-semibold"
                            : "text-white/55 hover:text-white hover:bg-white/10"
                        )}
                      >
                        {l.label}
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </NavEntry>
                    </motion.div>
                  );
                })}
                <div className="mt-2 pt-2 border-t border-white/10">
                  <Button variant="default" className="w-full rounded-lg" asChild>
                    <Link to="/kalkulator-online" onClick={() => setOpen(false)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Preis berechnen
                    </Link>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
};
