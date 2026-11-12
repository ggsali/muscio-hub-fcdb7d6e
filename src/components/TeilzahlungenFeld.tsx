import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { lokalesDatum } from "@/lib/umsatz";

interface Zahlung { id: string; betrag: number; datum: string; notiz: string | null }
const CHF = (n: number) => `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Teilzahlungen (Akonto) eines Auftrags. Jede Zahlung zählt im Monat ihres Datums zum Umsatz. */
export default function TeilzahlungenFeld({ orderId, status }: { orderId: string; status: string }) {
  const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
  const [total, setTotal] = useState(0);
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState(lokalesDatum(new Date()));
  const [notiz, setNotiz] = useState("");
  const [offen, setOffen] = useState(false);

  const laden = useCallback(async () => {
    const [{ data: z }, { data: o }] = await Promise.all([
      (supabase.from as any)("order_payments").select("id, betrag, datum, notiz").eq("order_id", orderId).order("datum", { ascending: true }),
      (supabase.from as any)("orders").select("umsatz_total").eq("id", orderId).maybeSingle(),
    ]);
    setZahlungen(((z ?? []) as any[]).map((r) => ({ ...r, betrag: Number(r.betrag) })));
    setTotal(Number(o?.umsatz_total) || 0);
  }, [orderId]);

  useEffect(() => { void laden(); }, [laden, status]);

  const summe = zahlungen.reduce((s, z) => s + z.betrag, 0);
  const rest = Math.max(0, Math.round((total - summe) * 100) / 100);

  const hinzufuegen = async () => {
    const b = Number(betrag.replace(",", "."));
    if (!(b > 0)) { toast.error("Bitte einen Betrag grösser 0 eingeben"); return; }
    const { error } = await (supabase.from as any)("order_payments").insert({ order_id: orderId, betrag: b, datum, notiz: notiz.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Teilzahlung gespeichert, zählt zum Umsatz");
    setBetrag(""); setNotiz(""); setOffen(false);
    void laden();
  };
  const loeschen = async (id: string) => {
    const { error } = await (supabase.from as any)("order_payments").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Teilzahlung entfernt"); void laden(); }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>Teilzahlungen</Label>
        {!offen && (
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={() => { setBetrag(rest > 0 ? String(rest) : ""); setOffen(true); }}>
            <Plus className="w-3 h-3" /> Teilzahlung
          </Button>
        )}
      </div>
      {zahlungen.length > 0 && (
        <ul className="rounded-md border border-border divide-y divide-border text-sm">
          {zahlungen.map((z) => (
            <li key={z.id} className="flex items-center justify-between px-3 py-1.5 gap-2">
              <span className="text-muted-foreground">{new Date(z.datum).toLocaleDateString("de-CH")}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">{z.notiz}</span>
              <span className="font-medium">{CHF(z.betrag)}</span>
              <button type="button" onClick={() => loeschen(z.id)} className="text-muted-foreground hover:text-destructive" aria-label="Teilzahlung löschen"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {offen && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Betrag (CHF)</Label><Input inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} className="bg-input border-border" /></div>
            <div><Label className="text-xs">Bezahlt am</Label><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="bg-input border-border" /></div>
          </div>
          <Input placeholder="Notiz (optional, z. B. Anzahlung)" value={notiz} onChange={(e) => setNotiz(e.target.value)} className="bg-input border-border" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={hinzufuegen}>Speichern</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOffen(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {zahlungen.length === 0
          ? "Zahlt der Kunde in Teilen, trage jede Zahlung hier ein. Sie zählt in dem Monat zum Umsatz, in dem sie eingegangen ist."
          : `Bezahlt ${CHF(summe)}${total > 0 ? ` von ${CHF(total)}, Rest ${CHF(rest)}` : ""}.`}
      </p>
    </div>
  );
}
