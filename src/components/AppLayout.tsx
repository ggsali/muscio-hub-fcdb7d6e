import React, { useState } from "react";
import { Outlet, useLocation } from "@/lib/router-compat";
import {
  LayoutDashboard, Users, Package, Library, Settings, ChevronLeft, Box,
  LogOut, FlaskConical, MessageSquare, Menu, X, CalendarDays, MessageCircle,
  Mail, Layers, Receipt, Smartphone, ShoppingBag, FileText, PenLine, Star,
  ShoppingCart, FolderKanban, BarChart3, Users2,
} from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminPwaInstall } from "@/hooks/useAdminPwaInstall";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const ic = "w-[18px] h-[18px]";

type NavItem = { to: string; icon: React.ReactNode; label: string; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Übersicht",
    items: [
      { to: "/admin", icon: <LayoutDashboard className={ic} />, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Aufträge & Kunden",
    items: [
      { to: "/admin/auftraege", icon: <Package className={ic} />, label: "Aufträge" },
      { to: "/admin/kunden", icon: <Users className={ic} />, label: "Kunden" },
      { to: "/admin/anfragen", icon: <MessageSquare className={ic} />, label: "Anfragen" },
      { to: "/admin/website/bestellungen", icon: <ShoppingBag className={ic} />, label: "Bestellungen" },
      { to: "/admin/chat", icon: <MessageCircle className={ic} />, label: "Live-Chat" },
    ],
  },
  {
    label: "Produktion",
    items: [
      { to: "/admin/druckplatten", icon: <Layers className={ic} />, label: "Druckplatten" },
      { to: "/admin/filamente", icon: <FlaskConical className={ic} />, label: "Filamente" },
      { to: "/admin/teile", icon: <Library className={ic} />, label: "Teile-Bibliothek" },
    ],
  },
  {
    label: "Finanzen",
    items: [
      { to: "/admin/finanzen", icon: <Receipt className={ic} />, label: "Übersicht", exact: true },
      { to: "/admin/finanzen/abrechnungen", icon: <FileText className={ic} />, label: "Abrechnungen" },
      { to: "/admin/finanzen/neue-rechnung", icon: <PenLine className={ic} />, label: "Neue Rechnung" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/admin/newsletter", icon: <Mail className={ic} />, label: "Newsletter" },
      { to: "/website-admin/reviews", icon: <Star className={ic} />, label: "Bewertungen" },
      { to: "/website-admin/blog", icon: <FileText className={ic} />, label: "Blog" },
    ],
  },
  {
    label: "Website",
    items: [
      { to: "/website-admin/shop-produkte", icon: <ShoppingCart className={ic} />, label: "Shop & Produkte" },
      { to: "/website-admin/projekte", icon: <FolderKanban className={ic} />, label: "Projekte" },
      { to: "/website-admin/analyse", icon: <BarChart3 className={ic} />, label: "Analytics" },
      { to: "/admin/website/kunden", icon: <Users2 className={ic} />, label: "Website-Kunden" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/kalender", icon: <CalendarDays className={ic} />, label: "Kalender" },
      { to: "/admin/einstellungen", icon: <Settings className={ic} />, label: "Einstellungen" },
    ],
  },
];

// Bottom nav shows only the 5 most important items on mobile
const mobileBottomNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/website/bestellungen", icon: ShoppingBag, label: "Bestellungen" },
  { to: "/admin/anfragen", icon: MessageSquare, label: "Anfragen" },
  { to: "/admin/kunden", icon: Users, label: "Kunden" },
  { to: "/admin/auftraege", icon: Package, label: "Aufträge" },
];

const GROUP_LABEL = "text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-1 mt-4";

function MobileLayout({ canInstall, onInstall }: { canInstall: boolean; onInstall: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Box className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-foreground text-[13px] tracking-tight">3DMuscio</span>
            <span className="text-[9px] text-muted-foreground font-medium tracking-wide uppercase">3D-Druck Service</span>
          </div>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] bg-sidebar border-sidebar-border p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                    <Box className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-foreground text-[13px]">3DMuscio Pro</span>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1 rounded hover:bg-sidebar-accent">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <nav className="flex-1 px-2 py-3 overflow-y-auto">
                {navGroups.map(group => (
                  <div key={group.label}>
                    <p className={GROUP_LABEL}>{group.label}</p>
                    <div className="space-y-0.5">
                      {group.items.map(item => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.exact}
                          onClick={() => setMenuOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )
                          }
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
                {canInstall && (
                  <button
                    onClick={() => { setMenuOpen(false); onInstall(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-primary hover:bg-muted transition-colors w-full"
                  >
                    <Smartphone className={cn(ic, "flex-shrink-0")} />
                    <span>Als App installieren</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
                >
                  <LogOut className={cn(ic, "flex-shrink-0")} />
                  <span>Abmelden</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 py-2 z-50">
        {mobileBottomNav.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[52px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function DesktopLayout({ canInstall, onInstall }: { canInstall: boolean; onInstall: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className="flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 flex-shrink-0 relative"
        style={{ width: collapsed ? 60 : 240 }}
      >
        <div className={`flex items-center gap-2.5 border-b border-sidebar-border flex-shrink-0 ${collapsed ? "px-3 py-4 justify-center" : "px-4 py-4"}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 glow-primary">
            <Box className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-foreground text-[13px] tracking-tight">3DMuscio</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">3D-Druck Service</span>
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label}>
              {collapsed ? (
                <div className="my-2 border-t border-sidebar-border" />
              ) : (
                <p className={GROUP_LABEL}>{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <SidebarNavLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    collapsed={collapsed}
                    exact={item.exact}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          {canInstall && (
            <button
              onClick={onInstall}
              title="Als App installieren"
              className={`flex items-center gap-3 rounded-lg text-sm text-primary hover:bg-muted transition-colors w-full ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}`}
            >
              <Smartphone className={cn(ic, "flex-shrink-0")} />
              {!collapsed && <span>Als App installieren</span>}
            </button>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}`}
          >
            <LogOut className={cn(ic, "flex-shrink-0")} />
            {!collapsed && <span>Abmelden</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}`}
          >
            <ChevronLeft className={cn(ic, "flex-shrink-0 transition-transform duration-200", collapsed && "rotate-180")} />
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function AppLayout() {
  const isMobile = useIsMobile();
  // AppLayout wird nur für eingeloggte Admins gerendert (AdminGate)
  const { canInstall, install } = useAdminPwaInstall(true);
  return isMobile
    ? <MobileLayout canInstall={canInstall} onInstall={install} />
    : <DesktopLayout canInstall={canInstall} onInstall={install} />;
}
