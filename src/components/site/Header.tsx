import { useState, useEffect, type ReactNode, type MouseEvent } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Menu, X, Printer, User, ShoppingCart, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";
import { useResinEnabled, isResinText } from "@/hooks/useResinEnabled";
import { useChristmasMode } from "@/hooks/useChristmasMode";
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
      { label: "STL-Datei drucken lassen", path: "/stl-drucken-lassen" },
      { label: "3D-Druck Schweiz", path: "/3d-druck-schweiz" },
    ],
  },
  {
    label: "Materialien",
    path: "/materialien",
    children: [
      { label: "PLA", path: "/materialien/pla" },
      { label: "PETG", path: "/materialien/petg" },
      { label: "ABS", path: "/materialien/abs" },
      { label: "ASA", path: "/materialien/asa" },
      { label: "TPU", path: "/materialien/tpu" },
      { label: "Resin", path: "/materialien/resin" },
      { label: "Alle Materialien vergleichen", path: "/materialien" },
    ],
  },
  {
    label: "Shop",
    path: "/shop",
    children: [
      { label: "Alle Produkte", path: "/shop" },
      { label: "Gutschein kaufen", path: "/gutschein" },
    ],
  },
  { label: "Projekte", path: "/projekte" },
  {
    label: "Wissen",
    path: "/blog",
    children: [
      { label: "Blog", path: "/blog" },
      { label: "3D-Druck Kosten Schweiz", path: "/wissen/3d-druck-kosten-schweiz" },
      { label: "Vergleiche", path: "/vergleich" },
      { label: "Häufige Fragen", path: "/faq" },
    ],
  },
  {
    label: "Über uns",
    path: "/ueber-uns",
    children: [
      { label: "Über 3DMuscio", path: "/ueber-uns" },
      { label: "Unsere Maschinen", path: "/maschinen" },
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
  onClick?: (e: MouseEvent) => void;
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
  const { totalItems, setIsOpen: setCartOpen } = useCart();
  const [navItems, setNavItems] = useState<NavItem[]>(NAV_ITEMS);
  const resin = useResinEnabled();
  const christmasMode = useChristmasMode();

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

  useEffect(() => {
    if (!openDropdown) return;
    const close = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.("[data-nav-dd]")) setOpenDropdown(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenDropdown(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [openDropdown]);

  return (
    <>
      <motion.header
        className="relative z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Eisrand am oberen Seitenrand, vor der Navigation und ohne Interaktion zu blockieren. */}
        {christmasMode && (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 1200 34"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 top-0 z-[70] hidden h-[34px] w-full overflow-visible lg:block"
          >
            <defs>
              <linearGradient id="site-top-icicle-ice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f6fcff" stopOpacity="0.95" />
                <stop offset="65%" stopColor="#d2edf8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#98cce3" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <path d="M0 0 H1200 V5 H0 Z" fill="url(#site-top-icicle-ice)" />
            {Array.from({ length: 24 }, (_, i) => {
              const x = i * 50 + 9;
              const length = 10 + ((i * 7) % 13);
              return (
                <path
                  key={i}
                  d={`M${x} 3 Q${x + 5} 7 ${x + 9} 4 L${x + 13} ${length + 5} Q${x + 15} ${length + 9} ${x + 17} ${length + 4} L${x + 22} 4 Q${x + 28} 7 ${x + 34} 3 Z`}
                  fill="url(#site-top-icicle-ice)"
                  stroke="#c6e9f7"
                  strokeOpacity="0.65"
                  strokeWidth="0.7"
                />
              );
            })}
          </svg>
        )}
        <div className="container mx-auto flex min-h-20 items-center justify-between gap-3 px-4 sm:px-6 lg:my-3 lg:min-h-[76px] lg:relative lg:rounded-[26px] lg:border lg:border-border/70 lg:bg-background/95 lg:px-5 lg:shadow-[0_12px_45px_-20px_hsl(var(--foreground)/0.22)] xl:px-7">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src={logo}
              alt="3DMuscio 3D-Druck Schweiz"
              className="h-11 w-11 rounded-xl object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span className="font-heading text-[16px] font-extrabold tracking-tight text-foreground">
                3D<span className="text-primary">Muscio</span>
              </span>
              <span className="mt-0.5 hidden text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
                3D-Druck Schweiz
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 self-stretch lg:flex">
            {visibleNav.map((l) => {
              const active = location.pathname === l.path;
              const hasChildren = l.children && l.children.length > 0;
              return (
                <div
                  key={l.path}
                  className="relative"
                  data-nav-dd
                >
                  <NavEntry
                    to={l.path}
                    onClick={(e) => {
                      if (hasChildren) {
                        e.preventDefault();
                        setOpenDropdown(openDropdown === l.path ? null : l.path);
                      }
                    }}
                    className={cn(
                      "group relative my-3 flex h-[calc(100%-1.5rem)] items-center gap-1.5 rounded-xl px-2.5 text-[14px] font-medium transition-all duration-200 xl:px-3 xl:text-[15px] hover:bg-accent/70",
                      active || l.isButton ? "text-foreground bg-primary/10" : "text-muted-foreground hover:text-foreground",
                      l.isButton && !active && "font-semibold text-primary hover:text-primary"
                    )}
                  >
                    {l.label}
                    {hasChildren && (
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", openDropdown === l.path && "rotate-180")} />
                    )}
                    <span
                      className={cn(
                        "absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary transition-transform duration-200 origin-left",
                        active || openDropdown === l.path ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      )}
                    />
                  </NavEntry>

                  <AnimatePresence>
                    {hasChildren && openDropdown === l.path && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-[calc(100%-2px)] z-50 min-w-[270px] pt-2"
                      >
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-[0_20px_50px_-20px_hsl(var(--foreground)/0.25)] backdrop-blur-xl">
                          {l.children!.map((c, idx) =>
                            c.divider ? (
                              <hr key={`divider-${idx}`} className="my-1 border-border" />
                            ) : (
                              <NavEntry
                                key={c.path}
                                to={c.path}
                                onClick={() => setOpenDropdown(null)}
                                className="block rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:pl-5 hover:text-foreground"
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

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link
              to={session ? accountTarget : "/anmelden"}
              aria-label={session ? "Mein Konto" : "Anmelden"}
              title={session ? "Mein Konto" : "Anmelden"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <User className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative rounded-full border border-border/60 bg-muted/40 p-2.5 transition-all hover:border-primary/40 hover:bg-primary/10"
              aria-label="Warenkorb"
            >
              <ShoppingCart className="h-[18px] w-[18px] text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </button>
            <Button variant="default" size="sm" asChild className="h-11 rounded-full px-4 text-xs font-semibold shadow-md shadow-primary/15 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 xl:px-5 xl:text-sm">
              <Link to="/kalkulator-online">
                <Printer className="mr-2 h-4 w-4" />
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
              className="rounded-md p-1.5 transition-colors hover:bg-accent"
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
              className="lg:hidden absolute left-0 right-0 top-full z-40 max-h-[calc(100vh-7rem)] overflow-y-auto border-b border-border bg-background shadow-xl"
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
                          "flex items-center justify-between px-4 py-3 min-h-[48px] rounded-md text-sm font-medium transition-colors",
                          active
                            ? "bg-accent font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {l.label}
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </NavEntry>
                    </motion.div>
                  );
                })}
                <div className="mt-2 border-t border-border pt-2">
                  <Button variant="default" className="w-full rounded-md" asChild>
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
