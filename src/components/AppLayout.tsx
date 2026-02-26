import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, Library, Calculator, Settings, Menu, ChevronLeft, Box, LogOut, FlaskConical, MessageSquare
} from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", icon: <LayoutDashboard className="w-[18px] h-[18px]" />, label: "Dashboard" },
  { to: "/kunden", icon: <Users className="w-[18px] h-[18px]" />, label: "Kunden" },
  { to: "/auftraege", icon: <Package className="w-[18px] h-[18px]" />, label: "Aufträge" },
  { to: "/anfragen", icon: <MessageSquare className="w-[18px] h-[18px]" />, label: "Anfragen" },
  { to: "/teile", icon: <Library className="w-[18px] h-[18px]" />, label: "Teile-Bibliothek" },
  { to: "/filamente", icon: <FlaskConical className="w-[18px] h-[18px]" />, label: "Filamente" },
  { to: "/kalkulator", icon: <Calculator className="w-[18px] h-[18px]" />, label: "Kalkulator" },
  { to: "/einstellungen", icon: <Settings className="w-[18px] h-[18px]" />, label: "Einstellungen" },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 flex-shrink-0 relative"
        style={{ width: collapsed ? 60 : 228 }}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center gap-2.5 border-b border-sidebar-border flex-shrink-0 ${collapsed ? "px-3 py-4 justify-center" : "px-4 py-4"}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 glow-primary">
            <Box className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-foreground text-[13px] tracking-tight">3DMuscio</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Pro Dashboard</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer: collapse toggle + logout */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors w-full ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}`}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Abmelden</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-3 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors w-full ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}`}
          >
            <ChevronLeft className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
