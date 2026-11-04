import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNoIndex } from "@/hooks/useNoIndex";
import type { Session } from "@supabase/supabase-js";
import { FlaskConical, ListChecks, Workflow, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/labor", label: "Testläufe", icon: ListChecks, end: true },
  { to: "/labor/ablauf", label: "Ablauf", icon: Workflow },
];

/** Labor: nur für Admins (inkl. Zwei-Faktor wie im Admin). Rein zum Testen, keine Kundendaten, keine Mails, keine Queue. */
export default function LaborLayout() {
  useNoIndex();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const role = useUserRole(session?.user.id);
  const [mfaOk, setMfaOk] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) navigate("/login", { replace: true });
    else if (session && role && role !== "admin") navigate("/portal", { replace: true });
  }, [session, role, navigate]);

  useEffect(() => {
    if (!session || role !== "admin") return;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!data) { setMfaOk(true); return; }
      const brauchtMfa = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
      if (brauchtMfa) navigate("/admin", { replace: true }); // dort erscheint die Zwei-Faktor-Abfrage
      setMfaOk(!brauchtMfa);
    });
  }, [session, role, navigate]);

  if (session === undefined || (session && role === undefined) || (role === "admin" && mfaOk === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session || role !== "admin" || !mfaOk) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-violet-600 text-white text-xs font-semibold tracking-widest text-center py-1.5 flex items-center justify-center gap-2">
        <FlaskConical className="h-3.5 w-3.5" /> LABOR · reiner Test, keine Kundendaten, keine Mails, keine Druckerqueue
      </div>
      <div className="flex flex-col md:flex-row">
        <aside className="md:w-56 md:min-h-[calc(100vh-28px)] border-b md:border-b-0 md:border-r border-border bg-card p-3 space-y-1">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück zum Admin
          </button>
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labor</div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }: { isActive: boolean }) =>
                cn("flex items-center gap-2 rounded-md px-2.5 py-2 text-sm", isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
