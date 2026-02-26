import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Kalkulator", path: "/kalkulator" },
  { label: "Materialien", path: "/materialien" },
  { label: "Über uns", path: "/ueber-uns" },
  { label: "Kontakt", path: "/kontakt" },
];

export const WebsiteHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-14 px-4">
        <Link to="/" className="font-heading text-lg font-extrabold tracking-tight text-foreground">
          3D<span className="text-primary">Muscio</span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5">
          {navLinks.map(l => (
            <Link
              key={l.path}
              to={l.path}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location.pathname === l.path
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Admin Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/kalkulator">Preis berechnen <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-background border-b border-border"
          >
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map(l => (
                <Link
                  key={l.path}
                  to={l.path}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === l.path
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Button size="default" className="mt-2" asChild>
                <Link to="/kalkulator" onClick={() => setOpen(false)}>Preis berechnen</Link>
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
