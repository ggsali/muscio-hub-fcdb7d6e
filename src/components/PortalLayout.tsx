import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNoIndex } from "@/hooks/useNoIndex";
import { LayoutDashboard, Package, User, LogOut, ArrowLeft, FileText, Calculator, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.jpeg";

const items = [
  { to: "/portal", label: "Übersicht", icon: LayoutDashboard, end: true },
  { to: "/portal/bestellungen", label: "Bestellungen", icon: Package, badgeKey: "openOrders" as const },
  { to: "/portal/dokumente", label: "Dokumente", icon: FileText },
  { to: "/kalkulator-online", label: "Neue Anfrage", icon: Calculator, highlight: true },
  { to: "/portal/profil", label: "Profil & Adresse", icon: User },
  { to: "/portal/passwort", label: "Passwort ändern", icon: Lock },
];

export default function PortalLayout() {
  useNoIndex();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const role = useUserRole(session?.user.id);
  const [openOrders, setOpenOrders] = useState<number>(0);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data: cust } = await supabase.from("customers").select("id").eq("auth_user_id", session.user.id).maybeSingle();
      if (!cust) return;
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", cust.id)
        .not("status", "in", "(Abgeschlossen,Storniert,Geliefert)");
      setOpenOrders(count || 0);
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    // Listener FIRST to catch SIGNED_IN from email confirmation hash tokens
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) {
      // Wait briefly so Supabase can process hash tokens from email links
      const t = setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session) navigate("/login", { replace: true });
        });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [session, navigate]);

  if (session === undefined || role === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <img
                src={logo}
                alt="3DMuscio"
                className="relative h-9 w-9 rounded-lg object-contain ring-1 ring-border group-hover:ring-primary/60 transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-card" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-sm font-extrabold tracking-tight text-foreground">
                3D<span className="text-primary">Muscio</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-muted-foreground">
                Mein Konto
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {role === "admin" && (
              <button onClick={() => navigate("/admin")} className="text-xs text-primary hover:underline">Zum Admin-Dashboard</button>
            )}
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Website
            </Link>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 ml-2">
              <LogOut className="w-4 h-4" /> Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-4 md:p-6">
        <nav className="space-y-1">
          {items.map(it => {
            const badgeCount = it.badgeKey === "openOrders" ? openOrders : 0;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  it.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                    : isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <it.icon className="w-4 h-4" />
                <span className="flex-1">{it.label}</span>
                {badgeCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
