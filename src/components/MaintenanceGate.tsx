import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Ported from src/App.tsx during the TanStack Start migration.
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [check, setCheck] = useState<{ active: boolean; msg: string } | null>(null);
  useEffect(() => {
    supabase.from("website_settings").select("value").eq("key", "wartungsmodus").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as any) || {};
        setCheck({ active: !!v.aktiv, msg: v.nachricht || "Die Website ist gerade in Wartung. Wir sind bald zurück." });
      });
  }, []);
  if (!check) return <>{children}</>;
  if (!check.active) return <>{children}</>;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center bg-card border border-border rounded-xl p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-primary text-xl">🛠</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Wartungsarbeiten</h1>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{check.msg}</p>
      </div>
    </div>
  );
}
