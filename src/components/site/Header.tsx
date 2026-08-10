import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Printer, User, ShoppingCart, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";
import type { Session } from "@supabase/supabase-js";

interface NavChild { label: string; path: string; }
interface NavItem { label: string; path: string; children?: NavChild[]; }

const DEFAULT_NAV: NavItem[] = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Kalkulator", path: "/kalkulator-online" },
  {
    label: "Leistungen",
    path: "/leistungen",
    children: [
      { label: "Ersatzteile drucken", path: "/ersatzteile" },
      { label: "Prototypen / Rapid Prototyping", path: "/prototypen" },
      { label: "Kleinserien", path: "/kleinserien" },
      { label: "Materialien", path: "/materialien" },
    ],
  },
  { label: "Materialien", path: "/materialien" },
  {
    label: "Über uns",
    path: "/ueber-uns",
    children: [
      { label: "Unsere Geschichte", path: "/ueber-uns#geschichte" },
      { label: "Zeitleiste", path: "/ueber-uns#zeitleiste" },
      { label: "Team", path: "/ueber-uns#team" },
      { label: "Standort", path: "/ueber-uns#standort" },
    ],
  },
  { label: "Blog", path: "/blog" },
  { label: "Kontakt", path: "/kontakt" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [navLinks, setNavLinks] = useState<NavItem[]>(DEFAULT_NAV);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const dropdownTimer = useRef<number | null>(null);
  const { totalItems, setIsOpen: setCartOpen } = useCart();

  useEffect(() => {
    supabase.from("website_settings").select("value").eq("key", "nav_links").maybeSingle()
      .then(({ data }) => {
        const v = (data as any)?.value;
        if (Array.isArray(v) && v.length) {
          // Merge children from defaults if admin-defined items match by path
          const merged: NavItem[] = (v as NavItem[]).map(item => {
            const def = DEFAULT_NAV.find(d => d.path === item.path);
            return def?.children ? { ...item, children: item.children || def.children } : item;
          });
          setNavLinks(merged);
        }
      });
  }, []);

  useEffect(() => { setOpen(false); setOpenDropdown(null); }, [location.pathname]);

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
    dropdownTimer.current = window.setTimeout(() => setOpenDropdown(null), 120);
  };

  return (
    <>
      <motion.header
        className={cn(
          "relative w-full transition-all duration-300",
          "bg-background/85 backdrop-blur-xl border-b border-border/50",
          scrolled || open ? "shadow-sm" : ""
        )}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="container mx-auto flex items-center justify-between h-14 px-4 sm:px-6">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img
                src={logo}
                alt="3DMuscio 3D-Druck Schweiz"
                className="relative h-8 w-8 rounded-lg object-contain ring-1 ring-white/20 group-hover:ring-primary/60 transition-all duration-300"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-background animate-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-[14px] font-extrabold tracking-tight text-foreground">
                3D<span className="text-primary">Muscio</span>
              </span>
              <span className="text-[8px] uppercase tracking-[0.2em] font-medium hidden sm:block text-muted-foreground">
                3D-Druck Schweiz
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = location.pathname === l.path;
              const hasChildren = l.children && l.children.length > 0;
              return (
                <div
                  key={l.path}
                  className="relative"
                  onMouseEnter={() => hasChildren && handleEnter(l.path)}
                  onMouseLeave={() => hasChildren && handleLeave()}
                >
                  <Link
                    to={l.path}
                    className="relative px-4 py-1.5 text-sm font-medium transition-colors group flex items-center gap-1"
                  >
                    <motion.span
                      className="absolute bottom-0 left-4 right-4 h-px bg-primary rounded-full"
                      initial={false}
                      animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ transformOrigin: "left" }}
                    />
                    <span className="absolute bottom-0 left-4 right-4 h-px rounded-full bg-foreground/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
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
                  </Link>

                  <AnimatePresence>
                    {hasChildren && openDropdown === l.path && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50 min-w-[200px]"
                      >
                        <div className="bg-popover border border-border rounded-xl shadow-xl p-1.5">
                          {l.children!.map(c => (
                            <Link
                              key={c.path}
                              to={c.path}
                              onClick={() => setOpenDropdown(null)}
                              className="block px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              {c.label}
                            </Link>
                          ))}
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
              className="rounded-full h-8 px-4 text-xs font-bold shadow-[0_0_20px_hsl(156_100%_40%/0.3)] hover:shadow-[0_0_32px_hsl(156_100%_40%/0.5)] transition-shadow">
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
              className="lg:hidden absolute left-0 right-0 top-full z-40 bg-foreground/95 backdrop-blur-xl border-b border-white/10 shadow-2xl max-h-[calc(100vh-7rem)] overflow-y-auto"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <nav className="flex flex-col p-3 gap-0.5">
                {navLinks.map((l, i) => {
                  const hasChildren = l.children && l.children.length > 0;
                  const isExpanded = openMobileGroup === l.path;
                  return (
                    <motion.div key={l.path} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="flex items-stretch">
                        <Link
                          to={l.path}
                          onClick={() => !hasChildren && setOpen(false)}
                          className={cn(
                            "flex-1 flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            location.pathname === l.path
                              ? "text-white bg-white/10 font-semibold"
                              : "text-white/55 hover:text-white hover:bg-white/10"
                          )}
                        >
                          {l.label}
                          {location.pathname === l.path && !hasChildren && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </Link>
                        {hasChildren && (
                          <button
                            onClick={() => setOpenMobileGroup(isExpanded ? null : l.path)}
                            className="px-3 text-white/55 hover:text-white"
                            aria-label="Untermenü"
                          >
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {hasChildren && isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden ml-4 border-l border-white/10 pl-3"
                          >
                            {l.children!.map(c => (
                              <Link
                                key={c.path}
                                to={c.path}
                                onClick={() => setOpen(false)}
                                className="block px-3 py-2 text-sm text-white/55 hover:text-white rounded-md"
                              >
                                {c.label}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
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
