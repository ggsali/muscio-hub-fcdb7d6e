import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, CheckCircle2, Clock } from "lucide-react";

type Bill = {
  id: string;
  titel: string;
  betrag: number;
  bezahlt: boolean;
  bezahlt_am: string | null;
  faellig_am: string | null;
  created_at: string;
  order_id: string | null;
  rechnungsnummer: string | null;
  rechnungs_datum: string | null;
  empfaenger_name: string | null;
  file_path: string | null;
  filename: string | null;
};

function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function FinanzenPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await (supabase.from as any)("bills")
      .select("id, titel, betrag, bezahlt, bezahlt_am, faellig_am, created_at, order_id, rechnungsnummer, rechnungs_datum, empfaenger_name, file_path, filename")
      .order("created_at", { ascending: false });
    setBills((data as Bill[]) || []);
    setLoading(false);
  }

  async function download(b: Bill) {
    if (!b.file_path) return;
    const { data } = await supabase.storage.from("bills").createSignedUrl(b.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const offen = bills.filter(b => !b.bezahlt).reduce((s, b) => s + Number(b.betrag || 0), 0);
  const bezahlt = bills.filter(b => b.bezahlt).reduce((s, b) => s + Number(b.betrag || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzen</h1>
          <p className="text-sm text-muted-foreground">Übersicht aller Rechnungen (Aufträge & manuelle Rechnungen)</p>
        </div>
        <Link to="/admin/finanzen/neue-rechnung">
          <Button><Plus className="w-4 h-4 mr-2" /> Manuelle Rechnung erstellen</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Rechnungen</p>
          <p className="text-2xl font-bold mt-1">{bills.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Offen</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">CHF {fmtCHF(offen)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Bezahlt</p>
          <p className="text-2xl font-bold mt-1 text-emerald-500">CHF {fmtCHF(bezahlt)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Alle Rechnungen</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Laden…</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Noch keine Rechnungen vorhanden.</div>
        ) : (
          <div className="divide-y divide-border">
            {bills.map(b => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="flex-shrink-0">
                  {b.bezahlt
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <Clock className="w-5 h-5 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {b.rechnungsnummer || b.titel || "Rechnung"}
                    </span>
                    {b.order_id
                      ? <Badge variant="secondary" className="text-[10px]">Auftrag</Badge>
                      : <Badge variant="outline" className="text-[10px]">Manuell</Badge>}
                    {b.bezahlt
                      ? <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px]">bezahlt</Badge>
                      : <Badge className="bg-amber-500/15 text-amber-500 text-[10px]">offen</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.empfaenger_name || b.titel}
                    {b.rechnungs_datum ? ` · ${new Date(b.rechnungs_datum).toLocaleDateString("de-CH")}` : ""}
                    {b.faellig_am ? ` · fällig ${new Date(b.faellig_am).toLocaleDateString("de-CH")}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">CHF {fmtCHF(Number(b.betrag || 0))}</p>
                </div>
                {b.file_path && (
                  <Button size="sm" variant="outline" onClick={() => download(b)}>
                    <FileText className="w-4 h-4 mr-1" /> PDF
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
