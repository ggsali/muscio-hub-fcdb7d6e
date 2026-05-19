import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Session } from "@supabase/supabase-js";
import {
  ShoppingBag, Star, FolderKanban, Users2, MessageCircle, Settings, Globe, ArrowLeft, LogOut,
  Handshake, UserCircle2, Navigation, Clock, Package, FileText, Cpu, Menu, X, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/website-admin", label: "Übersicht", icon: Globe, end: true },
  { to: "/website-admin/shop", label: "Shop-Übersicht", icon: TrendingUp },
  { to: "/website-admin/bestellungen", label: "Shop-Bestellungen", icon: ShoppingBag },
  { to: "/website-admin/shop-produkte", label: "Shop-Produkte", icon: Package },
  { to: "/website-admin/blog", label: "Blog / News", icon: FileText },
  { to: "/website-admin/reviews", label: "Bewertungen", icon: Star },
  { to: "/website-admin/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/website-admin/team", label: "Team", icon: UserCircle2 },
  { to: "/website-admin/timeline", label: "Zeitleiste", icon: Clock },
  { to: "/website-admin/partner", label: "Partner", icon: Handshake },
  { to: "/website-admin/equipment", label: "Maschinen & Equipment", icon: Cpu },
  { to: "/website-admin/navigation", label: "Navigation", icon: Navigation },
  { to: "/website-admin/kunden", label: "Website-Kunden", icon: Users2 },
  { to: "/website-admin/chat", label: "Chat-Postfach", icon: MessageCircle },
  { to: "/website-admin/einstellungen", label: "Website-Einstellungen", icon: Settings },
];

const mobileBottomNav = [
  { to: "/website-admin", icon: Globe, label: "Übersicht", end: true },
  { to: "/website-admin/shop", icon: ShoppingBag, label: "Shop" },
  { to: "/website-admin/chat", icon: MessageCircle, label: "Chat" },
  { to: "/website-admin/kunden", icon: Users2, label: "Kunden" },
  { to: "/website-admin/einstellungen", icon: Settings, label: "Settings" },
];

function MobileLayout({ onBack, onLogout }: { onBack: () => void; onLogout: () => Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Website-Admin</span>
          <span className="font-bold text-foreground text-[13px]">3DMuscio Web</span>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] bg-card border-border p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <span className="font-bold text-foreground text-[13px]">Website-Admin</span>
                <button onClick={() => setMenuOpen(false)} className="p-1 rounded hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
                {NAV.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )
                    }
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="px-2 py-3 border-t border-border space-y-1">
                <button onClick={onBack} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full">
                  <ArrowLeft className="w-[18px] h-[18px]" />
                  <span>Zum Projekt-Manager</span>
                </button>
                <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full">
                  <LogOut className="w-[18px] h-[18px]" />
                  <span>Abmelden</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around px-2 py-2 z-50">
        {mobileBottomNav.map(({ to, icon: Icon, label, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[52px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function DesktopLayout({ onBack, onLogout }: { onBack: () => void; onLogout: () => Promise<void> }) {
  return (
    <div className="min-h-screen flex bg-background w-full">
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
          <button onClick={onBack} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Zum Projekt-Manager
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
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

export default function WebsiteAdminLayout() {
  useNoIndex();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  const onBack = () => navigate("/admin");
  const onLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  return isMobile
    ? <MobileLayout onBack={onBack} onLogout={onLogout} />
    : <DesktopLayout onBack={onBack} onLogout={onLogout} />;
}
