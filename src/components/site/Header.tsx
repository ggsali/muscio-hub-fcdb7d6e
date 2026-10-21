import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { company } from "@/data/company";
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
        className="relative w-full border-b border-border bg-background"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Schmale Info-Leiste (nur Desktop) */}
        <div className="hidden bg-foreground text-background/80 lg:block">
          <div className="container mx-auto flex h-8 items-center justify-between px-6 text-xs">
            <span>Schweizer 3D-Druckservice · Eschlikon TG · Fertigung bei geeigneten Aufträgen in 48 h möglich*</span>
            <div className="flex items-center gap-5">
              <a href={`mailto:${company.email}`} className="transition-colors hover:text-background">{company.email}</a>
              {session ? (
                <Link to={accountTarget} className="flex items-center gap-1.5 transition-colors hover:text-background">
                  <User className="h-3 w-3" />{accountLabel}
                </Link>
              ) : (
                <Link to="/anmelden" className="transition-colors hover:text-background">Anmelden</Link>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src={logo}
              alt="3DMuscio 3D-Druck Schweiz"
              className="h-9 w-9 rounded-md object-contain"
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

          <nav className="hidden items-stretch gap-1 self-stretch lg:flex">
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
                  <NavEntry
                    to={l.path}
                    className={cn(
                      "relative flex h-full items-center gap-1 px-3.5 text-[15px] font-medium transition-colors group",
                      active || l.isButton ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      l.isButton && !active && "font-semibold text-primary hover:text-primary"
                    )}
                  >
                    {l.label}
                    {hasChildren && (
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", openDropdown === l.path && "rotate-180")} />
                    )}
                    <span
                      className={cn(
                        "absolute inset-x-3.5 bottom-0 h-[3px] bg-primary transition-transform duration-200 origin-left",
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
                        className="absolute left-0 top-full z-50 min-w-[230px]"
                      >
                        <div className="border border-border border-t-2 border-t-primary bg-popover p-1 shadow-lg">
                          {l.children!.map((c, idx) =>
                            c.divider ? (
                              <hr key={`divider-${idx}`} className="my-1 border-border" />
                            ) : (
                              <NavEntry
                                key={c.path}
                                to={c.path}
                                onClick={() => setOpenDropdown(null)}
                                className="block px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

          <div className="hidden items-center gap-3 lg:flex">
            <button
              onClick={() => setCartOpen(true)}
              className="relative rounded-md p-2 transition-colors hover:bg-accent"
              aria-label="Warenkorb"
            >
              <ShoppingCart className="h-[18px] w-[18px] text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </button>
            <Button variant="default" size="sm" asChild className="h-10 rounded-md px-5 text-sm font-semibold">
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
