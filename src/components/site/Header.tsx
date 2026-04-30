import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Printer, User, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";
import type { Session } from "@supabase/supabase-js";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Kalkulator", path: "/kalkulator-online" },
  { label: "Materialien", path: "/materialien" },
  { label: "Über uns", path: "/ueber-uns" },
  { label: "Kontakt", path: "/kontakt" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const role = useUserRole(session?.user.id);
  const { totalItems, setIsOpen: setCartOpen } = useCart();

  useEffect(() => { setOpen(false); }, [location.pathname]);

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

  const accountTarget = role === "admin" ? "/admin" : "/portal";
  const accountLabel = role === "admin" ? "Dashboard" : "Mein Konto";

  return (
    <>
      <motion.header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled || open
            ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
            : "bg-transparent"
        )}
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="container mx-auto flex items-center justify-between h-14 px-4">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img
                src={logo}
                alt="3DM"
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
              return (
                <Link
                  key={l.path}
                  to={l.path}
                  className="relative px-4 py-1.5 text-sm font-medium transition-colors group"
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
                </Link>
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
                <Link to="/login">Anmelden</Link>
              </Button>
            )}
            <Button variant="default" size="sm" asChild
              className="rounded-full h-8 px-4 text-xs font-bold shadow-[0_0_20px_hsl(153_100%_40%/0.3)] hover:shadow-[0_0_32px_hsl(153_100%_40%/0.5)] transition-shadow">
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
                <Link to="/login">Anmelden</Link>
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
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="lg:hidden fixed left-0 right-0 z-40 bg-foreground/95 backdrop-blur-xl border-b border-white/10 shadow-2xl max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            style={{ top: 56 }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col p-3 gap-0.5">
              {navLinks.map((l, i) => (
                <motion.div key={l.path} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link
                    to={l.path}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      location.pathname === l.path
                        ? "text-white bg-white/10 font-semibold"
                        : "text-white/55 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {l.label}
                    {location.pathname === l.path && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </Link>
                </motion.div>
              ))}
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
    </>
  );
};
