import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Mail, Save } from "lucide-react";
import { buildAbrechnungPdf } from "@/lib/pdfAbrechnungExport";
import { Abrechnung, STATUS_BADGE, fmtCHF, fmtDate } from "./AbrechnungenPage";

type Position = {
  id: string;
  typ: string;
  datum: string | null;
  beschreibung: string | null;
  betrag: number;
  order_id: string | null;
  ausgabe_id: string | null;
};

export default function AbrechnungDetailPage() {
  const { id } = useParams();
  const [abr, setAbr] = useState<Abrechnung | null>(null);
  const [positionen, setPositionen] = useState<Position[]>([]);
  const [notizen, setNotizen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (id) load(id); }, [id]);

  async function load(abrId: string) {
    setLoading(true);
    const [a, p] = await Promise.all([
      (supabase.from as any)("abrechnungen").select("*").eq("id", abrId).maybeSingle(),
      (supabase.from as any)("abrechnung_positionen").select("*").eq("abrechnung_id", abrId).order("datum", { ascending: true }),
    ]);
    setAbr(a.data as Abrechnung);
    setNotizen((a.data as any)?.notizen || "");
    setPositionen((p.data as Position[]) || []);
    setLoading(false);
  }

  async function saveNotizen() {
    if (!abr) return;
    setBusy(true);
    const { error } = await (supabase.from as any)("abrechnungen").update({ notizen }).eq("id", abr.id);
    setBusy(false);
    error ? toast.error("Speichern fehlgeschlagen") : toast.success("Notizen gespeichert");
  }

  function pdf() {
    if (!abr) return null;
    return buildAbrechnungPdf({
      nummer: abr.nummer,
      typ: abr.typ,
      zeitraum_von: abr.zeitraum_von,
      zeitraum_bis: abr.zeitraum_bis,
      einnahmen_total: Number(abr.einnahmen_total),
      ausgaben_total: Number(abr.ausgaben_total),
      gewinn_total: Number(abr.gewinn_total),
      mwst_satz: Number(abr.mwst_satz),
      mwst_betrag: Number(abr.mwst_betrag),
      notizen,
      positionen: positionen.map(p => ({ typ: p.typ, datum: p.datum, beschreibung: p.beschreibung, betrag: Number(p.betrag) })),
    });
  }

  async function downloadPdf() {
    const out = pdf();
    if (!out || !abr) return;
    out.doc.save(`${abr.nummer}.pdf`);
    try {
      const blob = out.doc.output("blob");
      const path = `abrechnungen/${abr.nummer}.pdf`;
      await supabase.storage.from("bills").upload(path, blob, { contentType: "application/pdf", upsert: true });
      await (supabase.from as any)("abrechnungen").update({ pdf_path: path }).eq("id", abr.id);
    } catch { /* Upload optional */ }
  }

  function exportCsv() {
    if (!abr) return;
    const head = ["Datum", "Typ", "Beschreibung", "Betrag CHF"];
    const lines = positionen.map(p => [
      p.datum || "",
      p.typ,
      `"${(p.beschreibung || "").replace(/"/g, '""')}"`,
      (p.typ === "ausgabe" ? "-" : "") + Number(p.betrag).toFixed(2),
    ].join(";"));
    const csv = [head.join(";"), ...lines, "", `Einnahmen;;;${Number(abr.einnahmen_total).toFixed(2)}`,
      `Ausgaben;;;-${Number(abr.ausgaben_total).toFixed(2)}`,
      `Gewinn;;;${Number(abr.gewinn_total).toFixed(2)}`,
      `MwSt ${abr.mwst_satz}%;;;${Number(abr.mwst_betrag).toFixed(2)}`].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${abr.nummer}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function sendMail() {
    const out = pdf();
    if (!out || !abr) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("send-manual-invoice", {
        body: {
          to: "info@3dmuscio.com",
          rechnungsnummer: abr.nummer,
          empfaenger_name: "3DMuscio",
          betreff: `Abrechnung ${fmtDate(abr.zeitraum_von)} – ${fmtDate(abr.zeitraum_bis)}`,
          pdfBase64: out.base64,
          pdfFilename: `${abr.nummer}.pdf`,
        },
      });
      if (error) throw error;
      await (supabase.from as any)("abrechnungen").update({ status: "gesendet" }).eq("id", abr.id);
      setAbr({ ...abr, status: "gesendet" });
      toast.success("Abrechnung per E-Mail gesendet");
    } catch (e: any) {
      toast.error("E-Mail-Versand fehlgeschlagen: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Laden…</div>;
  if (!abr) return <div className="p-6 text-sm text-muted-foreground">Abrechnung nicht gefunden.</div>;

  const gewinnNachMwst = Number(abr.gewinn_total) - Number(abr.mwst_betrag);
  const einnahmen = positionen.filter(p => p.typ === "einnahme");
  const ausgaben = positionen.filter(p => p.typ === "ausgabe");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/finanzen/abrechnungen" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Abrechnungen
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold text-foreground">{abr.nummer}</h1>
            <Badge className={`text-[10px] ${STATUS_BADGE[abr.status] || "bg-muted"}`}>{abr.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {fmtDate(abr.zeitraum_von)} – {fmtDate(abr.zeitraum_bis)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          <Button variant="outline" onClick={sendMail} disabled={busy}><Mail className="w-4 h-4 mr-2" /> E-Mail</Button>
          <Button onClick={downloadPdf}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Einnahmen", value: Number(abr.einnahmen_total), cls: "text-emerald-500" },
          { label: "Ausgaben", value: Number(abr.ausgaben_total), cls: "text-destructive" },
          { label: "Gewinn", value: Number(abr.gewinn_total), cls: Number(abr.gewinn_total) >= 0 ? "text-emerald-500" : "text-destructive" },
          { label: `MwSt ${abr.mwst_satz}%`, value: Number(abr.mwst_betrag), cls: "text-foreground" },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.cls}`}>CHF {fmtCHF(k.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gewinn nach MwSt</p>
        <p className={`text-lg font-bold ${gewinnNachMwst >= 0 ? "text-emerald-500" : "text-destructive"}`}>
          CHF {fmtCHF(gewinnNachMwst)}
        </p>
      </div>

      {[{ title: "Einnahmen", items: einnahmen, sign: "" }, { title: "Ausgaben", items: ausgaben, sign: "-" }].map(sec => (
        <div key={sec.title} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">{sec.title}</h2>
            <span className="text-xs text-muted-foreground">{sec.items.length} Positionen</span>
          </div>
          {sec.items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Keine Positionen im Zeitraum.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {sec.items.map(p => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground w-28">{fmtDate(p.datum)}</td>
                      <td className="px-4 py-2">
                        {p.order_id ? (
                          <Link to={`/admin/auftraege/${p.order_id}`} className="hover:text-primary">{p.beschreibung}</Link>
                        ) : p.beschreibung}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">{sec.sign}CHF {fmtCHF(Number(p.betrag))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <Label>Notizen</Label>
        <Textarea value={notizen} onChange={e => setNotizen(e.target.value)} rows={4} placeholder="Interne Notizen zur Abrechnung…" />
        <Button size="sm" onClick={saveNotizen} disabled={busy}><Save className="w-4 h-4 mr-2" /> Speichern</Button>
      </div>
    </div>
  );
}
