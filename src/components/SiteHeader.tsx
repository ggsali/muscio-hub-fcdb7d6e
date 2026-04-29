import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { Box, Menu, X, LogIn, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Start" },
  { to: "/kalkulator-online", label: "Preisrechner" },
  { to: "/faq", label: "FAQ" },
  { to: "/kontakt", label: "Kontakt" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const navigate = useNavigate();
  const role = useUserRole(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userArea = (
    <>
      {!userId ? (
        <Button onClick={() => navigate("/login")} variant="outline" size="sm" className="gap-1.5">
          <LogIn className="w-4 h-4" /> Login
        </Button>
      ) : role === "admin" ? (
        <Button onClick={() => navigate("/admin")} size="sm" className="gap-1.5">
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </Button>
      ) : (
        <Button onClick={() => navigate("/portal")} size="sm" className="gap-1.5">
          <User className="w-4 h-4" /> Mein Konto
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Box className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight">3DMuscio</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">3D-Druck Schweiz</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => cn(
                "px-3 py-2 rounded-md text-sm transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">{userArea}</div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden p-2 rounded-md hover:bg-muted">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[260px] bg-background border-border p-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-bold">Menü</span>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <nav className="p-2 space-y-1">
              {links.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    "block px-3 py-2.5 rounded-md text-sm",
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="pt-3 border-t border-border mt-3">{userArea}</div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
