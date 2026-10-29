import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Empfängt Scans vom Scanner am Server (Tabelle scan_events, per Realtime).
 * Der Callback wird nur für Scans aufgerufen, die nach dem Öffnen der Seite eintreffen.
 * Eine Seite ruft den Hook auf, sobald ihr Scan-Feld aktiv ist.
 */
export function useServerScan(onScan: (code: string) => void, aktiv = true) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!aktiv) return;
    const ab = Date.now() - 2000;
    const ch = (supabase as any)
      .channel(`server-scan-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_events" }, (payload: any) => {
        const code = String(payload?.new?.code ?? "");
        const t = payload?.new?.created_at ? new Date(payload.new.created_at).getTime() : Date.now();
        if (code && t >= ab) cb.current(code);
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [aktiv]);
}
