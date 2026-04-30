import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Session } from "@supabase/supabase-js";
import {
  ShoppingBag, Star, FolderKanban, Users2, MessageCircle, Mail, Settings, Globe, ArrowLeft, LogOut, Handshake, UserCircle2, Navigation, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/website-admin", label: "Übersicht", icon: Globe, end: true },
  { to: "/website-admin/bestellungen", label: "Shop-Bestellungen", icon: ShoppingBag },
  { to: "/website-admin/reviews", label: "Bewertungen", icon: Star },
  { to: "/website-admin/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/website-admin/team", label: "Team", icon: UserCircle2 },
  { to: "/website-admin/timeline", label: "Zeitleiste", icon: Clock },
  { to: "/website-admin/partner", label: "Partner", icon: Handshake },
  { to: "/website-admin/navigation", label: "Navigation", icon: Navigation },
  { to: "/website-admin/kunden", label: "Website-Kunden", icon: Users2 },
  { to: "/website-admin/chat", label: "Chat-Postfach", icon: MessageCircle },
  { to: "/website-admin/email-templates", label: "E-Mail-Vorlagen", icon: Mail },
  { to: "/website-admin/einstellungen", label: "Website-Einstellungen", icon: Settings },
];

export default function WebsiteAdminLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const role = useUserRole(session?.user.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) navigate("/login", { replace: true });
    else if (session && role && role !== "admin") navigate("/portal", { replace: true });
  }, [session, role, navigate]);

  if (session === undefined || (session && role === undefined)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session || role !== "admin") return null;

  return (
    <div className="dark min-h-screen flex bg-background w-full">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Website-Admin</p>
          <h1 className="font-heading text-lg font-bold text-foreground mt-1">3DMuscio Web</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Zum Projekt-Manager
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
