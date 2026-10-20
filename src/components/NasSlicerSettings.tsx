import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const KEYS = { on: "public_nas_slice_enabled", only: "public_nas_only" } as const;

/** Schalter für die Preisschätzung im Online-Kalkulator: NAS-Slicer an/aus und "nur NAS" (Browser-Slicer aus). Speichert sofort. */
export function NasSlicerSettings() {
  const [on, setOn] = useState(false);
  const [only, setOnly] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", [KEYS.on, KEYS.only]).then(({ data }) => {
      setOn(data?.find((r) => r.key === KEYS.on)?.value === "true");
      setOnly(data?.find((r) => r.key === KEYS.only)?.value === "true");
      setBusy(false);
    });
  }, []);

  const save = async (key: string, value: boolean) => {
    setBusy(true);
    const { error } = await supabase.from("settings").upsert({ key, value: String(value) }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast.error("Speichern fehlgeschlagen"); return false; }
    toast.success("Gespeichert");
    return true;
  };

  return (
    <>
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div>
          <span className="text-sm font-medium">NAS-Slicer für Preisschätzung im Kalkulator</span>
          <p className="text-xs text-muted-foreground">Der Online-Kalkulator berechnet Preise über deinen NAS-Slicer.</p>
        </div>
        <Switch checked={on} disabled={busy} onCheckedChange={async (v) => {
          if (await save(KEYS.on, v)) { setOn(v); if (!v && only) { if (await save(KEYS.only, false)) setOnly(false); } }
        }} />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div>
          <span className="text-sm font-medium">Nur NAS-Slicer verwenden (Browser-Slicer aus)</span>
          <p className="text-xs text-muted-foreground">Kein Ausweichen auf den Browser-Slicer. Klappt das NAS nicht, erhält der Kunde eine Schätzung. Nur möglich, wenn der NAS-Slicer an ist. Wirkt nach bis zu 5 Minuten.</p>
        </div>
        <Switch checked={only} disabled={busy || !on} onCheckedChange={async (v) => { if (await save(KEYS.only, v)) setOnly(v); }} />
      </div>
    </>
  );
}
