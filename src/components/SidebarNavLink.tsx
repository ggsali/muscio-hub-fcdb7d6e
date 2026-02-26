import React from "react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SidebarNavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

export const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({ to, icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  return (
    <RouterNavLink to={to}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        )}
      >
        <span className={cn("flex-shrink-0", isActive && "text-primary")}>{icon}</span>
        {!collapsed && <span>{label}</span>}
      </div>
    </RouterNavLink>
  );
};
