import React, { useState } from "react";
import { Outlet } from "@/lib/router-compat";
import { FlaskConical, Calculator, Printer, PiggyBank, ListChecks, LogOut, Menu, X, Sun, Moon } from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useIsMobile } from "@/hooks/use-mobile";

const ic = "w-[18px] h-[18px]";

// Bewusst kein Link zum normalen Admin (Kunden, Auftraege, Rechnungen).
const items = [
  { to: "/labor", icon: <ListChecks className={ic} />, label: "Testläufe", exact: true },
  { to: "/labor/kalkulator", icon: <Calculator className={ic} />, label: "Kalkulator" },
  { to: "/labor/slicer", icon: <Printer className={ic} />, label: "Slicer" },
  { to: "/labor/spardose", icon: <PiggyBank className={ic} />, label: "Spardose" },
];

function Banner() {
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/40 text-xs px-4 py-1.5 text-center font-medium flex-shrink-0">
      LABOR – Testumgebung. Hier werden keine Kundendaten gelesen oder geschrieben und keine Mails versendet.
    </div>
  );
}

export default function LaborLayout() {
  const isMobile = useIsMobile();
  const { isDark, toggle } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = () => supabase.auth.signOut();

  const nav = (
    <nav className="space-y-0.5">
      {items.map((i) => (
        <SidebarNavLink key={i.to} to={i.to} icon={i.icon} label={i.label} exact={i.exact} collapsed={false} />
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-1 pt-3 border-t border-border">
      <button onClick={toggle} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full">
        {isDark ? <Sun className={ic} /> : <Moon className={ic} />}
        <span>{isDark ? "Hell" : "Dunkel"}</span>
      </button>
      <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full">
        <LogOut className={ic} />
        <span>Abmelden</span>
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <FlaskConical className="w-3.5 h-3.5 text-primary-foreground" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-foreground text-[13px] tracking-tight">3DMuscio</span>
        <span className="text-[9px] text-muted-foreground font-medium tracking-wide uppercase">Labor</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <Banner />
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar flex-shrink-0">
          {brand}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-sidebar-accent"><Menu className="w-5 h-5" /></button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-sidebar p-0">
              <div className="flex flex-col h-full p-3 gap-3" onClick={() => setMenuOpen(false)}>
                <div className="flex items-center justify-between">
                  {brand}
                  <button className="p-1 rounded hover:bg-sidebar-accent"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1">{nav}</div>
                {footer}
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Banner />
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 flex-shrink-0 border-r border-border bg-sidebar p-3 flex flex-col gap-4">
          {brand}
          <div className="flex-1">{nav}</div>
          {footer}
        </aside>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
