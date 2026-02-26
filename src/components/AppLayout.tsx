import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, Library, Calculator, Settings, Menu, X, Box, LogOut, FlaskConical
} from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
  { to: "/kunden", icon: <Users className="w-5 h-5" />, label: "Kunden" },
  { to: "/auftraege", icon: <Package className="w-5 h-5" />, label: "Aufträge" },
  { to: "/teile", icon: <Library className="w-5 h-5" />, label: "Teile-Bibliothek" },
  { to: "/filamente", icon: <FlaskConical className="w-5 h-5" />, label: "Filamente" },
  { to: "/kalkulator", icon: <Calculator className="w-5 h-5" />, label: "Kalkulator" },
  { to: "/einstellungen", icon: <Settings className="w-5 h-5" />, label: "Einstellungen" },
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
        className="flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 flex-shrink-0"
        style={{ width: collapsed ? 56 : 220 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Box className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-foreground text-sm">3dMuscio</span>}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center p-2 m-2 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
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

        {/* Logout */}
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Abmelden</span>}
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
