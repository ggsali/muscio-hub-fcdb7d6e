import React from "react";
import { NavLink as RouterNavLink, useLocation } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

interface SidebarNavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  exact?: boolean;
}

export const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({ to, icon, label, collapsed, exact }) => {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || (to !== "/" && location.pathname.startsWith(to + "/"));

  return (
    <RouterNavLink to={to} title={collapsed ? label : undefined}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className={cn("flex-shrink-0", isActive && "text-primary")}>{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
    </RouterNavLink>
  );
};
