import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Zahlungsdatum eines Auftrags. Bestimmt, in welchem Monat der Umsatz zählt. */
export default function BezahltAmFeld({ orderId, status }: { orderId: string; status: string }) {
  const [wert, setWert] = useState("");
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (supabase.from as any)("orders").select("bezahlt_am").eq("id", orderId).maybeSingle().then(({ data }: any) => {
      if (!aktiv) return;
      setWert(data?.bezahlt_am ?? "");
      setGeladen(true);
    });
    return () => { aktiv = false; };
  }, [orderId, status]);

  const speichern = async (neu: string) => {
    setWert(neu);
    const { error } = await (supabase.from as any)("orders").update({ bezahlt_am: neu || null }).eq("id", orderId);
    if (error) toast.error(error.message);
    else toast.success(neu ? "Zahlungsdatum gespeichert" : "Zahlungsdatum entfernt");
  };

  if (!geladen) return null;
  return (
    <div className="space-y-1.5">
      <Label>Bezahlt am</Label>
      <Input type="date" value={wert} onChange={(e) => speichern(e.target.value)} className="bg-input border-border" />
      <p className="text-xs text-muted-foreground">Der Umsatz zählt in dem Monat, in dem der Kunde bezahlt hat. Leer = noch nicht bezahlt oder unbekannt.</p>
    </div>
  );
}
