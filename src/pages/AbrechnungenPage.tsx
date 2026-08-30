import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, CalendarRange, ClipboardList, Pencil, Plus } from "lucide-react";

export type AbrechnungTyp = "monatsabrechnung" | "quartalsabrechnung" | "jahresabrechnung" | "individuell";

export type Abrechnung = {
  id: string;
  nummer: string;
  typ: string;
  zeitraum_von: string;
  zeitraum_bis: string;
  status: string;
  einnahmen_total: number;
  ausgaben_total: number;
  gewinn_total: number;
  mwst_satz: number;
  mwst_betrag: number;
  notizen: string | null;
  pdf_path: string | null;
  erstellt_am: string;
};

export const PAID_STATUS = ["Bezahlt", "Abgeschlossen"];

export function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("de-CH");
}

export const STATUS_BADGE: Record<string, string> = {
  entwurf: "bg-muted text-muted-foreground",
  erstellt: "bg-blue-500/15 text-blue-400",
  gesendet: "bg-emerald-500/15 text-emerald-500",
  archiviert: "bg-foreground/10 text-foreground/60",
};

const TYP_LABEL: Record<string, string> = {
  monatsabrechnung: "Monat",
  quartalsabrechnung: "Quartal",
  jahresabrechnung: "Jahr",
  individuell: "Individuell",
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultRange(typ: AbrechnungTyp): { von: string; bis: string } {
  const now = new Date();
  if (typ === "monatsabrechnung") {
    return { von: iso(new Date(now.getFullYear(), now.getMonth(), 1)), bis: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (typ === "quartalsabrechnung") {
    const q = Math.floor(now.getMonth() / 3);
    return { von: iso(new Date(now.getFullYear(), q * 3, 1)), bis: iso(new Date(now.getFullYear(), q * 3 + 3, 0)) };
  }
  if (typ === "jahresabrechnung") {
    return { von: iso(new Date(now.getFullYear(), 0, 1)), bis: iso(new Date(now.getFullYear(), 11, 31)) };
  }
  return { von: iso(new Date(now.getFullYear(), now.getMonth(), 1)), bis: iso(now) };
}

export default function AbrechnungenPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Abrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typ, setTyp] = useState<AbrechnungTyp>("monatsabrechnung");
  const [range, setRange] = useState(defaultRange("monatsabrechnung"));
  const [mwstSatz, setMwstSatz] = useState("8.1");

  useEffect(() => { load(); }, []);
  useEffect(() => { setRange(defaultRange(typ)); }, [typ]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase.from as any)("abrechnungen")
      .select("*")
      .order("erstellt_am", { ascending: false });
    setRows((data as Abrechnung[]) || []);
    setLoading(false);
  }

  async function nextNummer() {
    const year = new Date().getFullYear();
    const { count } = await (supabase.from as any)("abrechnungen")
      .select("*", { count: "exact", head: true })
      .like("nummer", `ABR-${year}-%`);
    return `ABR-${year}-${String((count || 0) + 1).padStart(3, "0")}`;
  }

  async function generate() {
    if (!range.von || !range.bis || range.von > range.bis) {
      toast.error("Bitte gültigen Zeitraum wählen");
      return;
    }
    setBusy(true);
    try {
      const [ordersRes, ausgabenRes] = await Promise.all([
        (supabase.from as any)("orders")
          .select("id, name, beschreibung, datum, created_at, status, umsatz_total")
          .order("created_at", { ascending: true }),
        (supabase.from as any)("ausgaben")
          .select("id, datum, kategorie, beschreibung, betrag")
          .gte("datum", range.von)
          .lte("datum", range.bis),
      ]);

      const orders = ((ordersRes.data as any[]) || []).filter(o => {
        const d = (o.datum || o.created_at || "").slice(0, 10);
        return d >= range.von && d <= range.bis && PAID_STATUS.includes(o.status || "");
      });
      const ausgaben = (ausgabenRes.data as any[]) || [];

      const einnahmen = orders.reduce((s, o) => s + Number(o.umsatz_total || 0), 0);
      const ausgabenTotal = ausgaben.reduce((s, a) => s + Number(a.betrag || 0), 0);
      const gewinn = einnahmen - ausgabenTotal;
      const satz = parseFloat(mwstSatz) || 0;
      const mwst = Math.round(Math.max(0, gewinn) * (satz / 100) * 100) / 100;

      const nummer = await nextNummer();
      const { data: abr, error } = await (supabase.from as any)("abrechnungen").insert({
        nummer,
        typ,
        zeitraum_von: range.von,
        zeitraum_bis: range.bis,
        status: "erstellt",
        einnahmen_total: Math.round(einnahmen * 100) / 100,
        ausgaben_total: Math.round(ausgabenTotal * 100) / 100,
        gewinn_total: Math.round(gewinn * 100) / 100,
        mwst_satz: satz,
        mwst_betrag: mwst,
      }).select().single();
      if (error) throw error;

      const positionen = [
        ...orders.map(o => ({
          abrechnung_id: abr.id,
          typ: "einnahme",
          datum: (o.datum || o.created_at || "").slice(0, 10),
          beschreibung: o.name || o.beschreibung || `Auftrag ${String(o.id).slice(0, 8)}`,
          betrag: Number(o.umsatz_total || 0),
          order_id: o.id,
        })),
        ...ausgaben.map(a => ({
          abrechnung_id: abr.id,
          typ: "ausgabe",
          datum: a.datum,
          beschreibung: `${a.kategorie}: ${a.beschreibung}`,
          betrag: Number(a.betrag || 0),
          ausgabe_id: a.id,
        })),
      ];
      if (positionen.length) {
        const { error: posErr } = await (supabase.from as any)("abrechnung_positionen").insert(positionen);
        if (posErr) throw posErr;
      }

      toast.success(`${nummer} erstellt`);
      setOpen(false);
      navigate(`/admin/finanzen/abrechnungen/${abr.id}`);
    } catch (e: any) {
      toast.error("Abrechnung konnte nicht erstellt werden: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const typCards: { key: AbrechnungTyp; icon: any; label: string; hint: string }[] = useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return [
      { key: "monatsabrechnung", icon: CalendarDays, label: "Monat", hint: now.toLocaleDateString("de-CH", { month: "long", year: "numeric" }) },
      { key: "quartalsabrechnung", icon: CalendarRange, label: "Quartal", hint: `Q${q} ${now.getFullYear()}` },
      { key: "jahresabrechnung", icon: ClipboardList, label: "Jahr", hint: String(now.getFullYear()) },
      { key: "individuell", icon: Pencil, label: "Individuell", hint: "Von–Bis wählen" },
    ];
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/finanzen" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Finanzen
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">Abrechnungen</h1>
          <p className="text-sm text-muted-foreground">Monats-, Quartals- und Jahresabrechnungen mit MwSt und PDF</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Abrechnung erstellen</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Laden…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Noch keine Abrechnungen erstellt.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Nummer</th>
                  <th className="text-left px-4 py-2">Typ</th>
                  <th className="text-left px-4 py-2">Zeitraum</th>
                  <th className="text-right px-4 py-2">Einnahmen</th>
                  <th className="text-right px-4 py-2">Ausgaben</th>
                  <th className="text-right px-4 py-2">Gewinn</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/admin/finanzen/abrechnungen/${r.id}`)}
                  >
                    <td className="px-4 py-2 font-medium">{r.nummer}</td>
                    <td className="px-4 py-2">{TYP_LABEL[r.typ] || r.typ}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      {fmtDate(r.zeitraum_von)} – {fmtDate(r.zeitraum_bis)}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-500">CHF {fmtCHF(Number(r.einnahmen_total))}</td>
                    <td className="px-4 py-2 text-right text-destructive">CHF {fmtCHF(Number(r.ausgaben_total))}</td>
                    <td className={`px-4 py-2 text-right ${Number(r.gewinn_total) >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      CHF {fmtCHF(Number(r.gewinn_total))}
                    </td>
                    <td className="px-4 py-2">
                      <Badge className={`text-[10px] ${STATUS_BADGE[r.status] || "bg-muted"}`}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neue Abrechnung</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {typCards.map(c => (
                <button
                  key={c.key}
                  onClick={() => setTyp(c.key)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    typ === c.key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <c.icon className="w-4 h-4 mb-1 text-primary" />
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground">{c.hint}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Von</Label>
                <Input type="date" value={range.von} onChange={e => setRange({ ...range, von: e.target.value })} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="date" value={range.bis} onChange={e => setRange({ ...range, bis: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>MwSt-Satz</Label>
              <Select value={mwstSatz} onValueChange={setMwstSatz}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 % (nicht MwSt-pflichtig)</SelectItem>
                  <SelectItem value="8.1">8.1 % (Standard)</SelectItem>
                  <SelectItem value="2.6">2.6 % (reduziert)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                MwSt wird auf den Gewinn berechnet – bitte beim Treuhänder/Steuerberater prüfen.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={generate} disabled={busy}>{busy ? "Generieren…" : "Abrechnung generieren"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
