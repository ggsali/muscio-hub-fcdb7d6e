import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Save, FileDown, Mail, ArrowLeft } from "lucide-react";
import { exportManualBillPDF, ManualBillItem } from "@/lib/pdfManualBillExport";

type Customer = {
  id: string;
  name: string | null;
  vorname: string | null;
  firma: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  email: string | null;
};

type Row = {
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis_chf: number;
};

const MWST_OPTIONS = [0, 2.6, 3.8, 8.1];

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

async function nextRechnungsnummer(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;
  const { data } = await (supabase.from as any)("bills")
    .select("rechnungsnummer")
    .like("rechnungsnummer", `${prefix}%`)
    .order("rechnungsnummer", { ascending: false })
    .limit(1);
  const last = data?.[0]?.rechnungsnummer as string | undefined;
  const n = last ? parseInt(last.slice(prefix.length), 10) : 0;
  return `${prefix}${String((isNaN(n) ? 0 : n) + 1).padStart(3, "0")}`;
}

export default function NeueRechnungPage() {
  const nav = useNavigate();
  const { company } = useCompanySettings();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selCustomerId, setSelCustomerId] = useState<string>("_frei");

  const [rechnungsnummer, setRechnungsnummer] = useState("");
  const [rechnungsDatum, setRechnungsDatum] = useState(todayISO());
  const [faelligAm, setFaelligAm] = useState(todayISO(30));
  const [betreff, setBetreff] = useState("");

  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [adresse, setAdresse] = useState("");
  const [email, setEmail] = useState("");

  const [mwst, setMwst] = useState<number>(0);
  const [rows, setRows] = useState<Row[]>([
    { beschreibung: "", menge: 1, einheit: "Stk", einzelpreis_chf: 0 },
  ]);

  const [saving, setSaving] = useState(false);
  const [savedBillId, setSavedBillId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const nr = await nextRechnungsnummer();
      setRechnungsnummer(nr);
      const { data } = await supabase.from("customers")
        .select("id, name, vorname, firma, strasse, plz, ort, land, email")
        .order("name");
      setCustomers((data as Customer[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (selCustomerId === "_frei") return;
    const c = customers.find(x => x.id === selCustomerId);
    if (!c) return;
    const fullName = [c.vorname, c.name].filter(Boolean).join(" ").trim();
    setName(fullName);
    setFirma(c.firma || "");
    setAdresse([c.strasse, [c.plz, c.ort].filter(Boolean).join(" "), c.land].filter(Boolean).join("\n"));
    setEmail(c.email || "");
  }, [selCustomerId, customers]);

  const totals = useMemo(() => {
    const zwischensumme = rows.reduce((s, r) => s + (Number(r.menge) || 0) * (Number(r.einzelpreis_chf) || 0), 0);
    const mwstBetrag = zwischensumme * mwst / 100;
    return { zwischensumme, mwstBetrag, gesamt: zwischensumme + mwstBetrag };
  }, [rows, mwst]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addRow() {
    setRows(prev => [...prev, { beschreibung: "", menge: 1, einheit: "Stk", einzelpreis_chf: 0 }]);
  }
  function removeRow(i: number) {
    setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  }

  function buildItems(): ManualBillItem[] {
    return rows.map(r => ({
      beschreibung: r.beschreibung,
      menge: Number(r.menge) || 0,
      einheit: r.einheit,
      einzelpreis_chf: Number(r.einzelpreis_chf) || 0,
      gesamtpreis_chf: (Number(r.menge) || 0) * (Number(r.einzelpreis_chf) || 0),
    }));
  }

  function validate(): string | null {
    if (!rechnungsnummer.trim()) return "Rechnungsnummer fehlt";
    if (!name.trim()) return "Empfängername fehlt";
    if (rows.length === 0) return "Mindestens eine Position erforderlich";
    if (rows.some(r => !r.beschreibung.trim())) return "Alle Positionen benötigen eine Beschreibung";
    return null;
  }

  async function handleSave(): Promise<string | null> {
    const err = validate();
    if (err) { toast({ description: err, variant: "destructive" }); return null; }
    setSaving(true);
    try {
      const items = buildItems();
      const { data: bill, error } = await (supabase.from as any)("bills").insert({
        order_id: null,
        titel: betreff || `Manuelle Rechnung ${rechnungsnummer}`,
        betrag: totals.gesamt,
        faellig_am: faelligAm || null,
        rechnungsnummer,
        rechnungs_datum: rechnungsDatum,
        empfaenger_name: name,
        empfaenger_firma: firma,
        empfaenger_adresse: adresse,
        empfaenger_email: email,
        betreff,
        mwst_prozent: mwst,
      }).select("id").single();
      if (error) throw error;
      const billId = (bill as any).id as string;

      if (items.length) {
        const { error: iErr } = await (supabase.from as any)("bill_items").insert(
          items.map((it, i) => ({ ...it, bill_id: billId, position: i }))
        );
        if (iErr) throw iErr;
      }

      // PDF erzeugen und im Storage ablegen, damit die Rechnung später
      // in der Finanzen-Liste heruntergeladen werden kann.
      try {
        const dataUri = (await exportManualBillPDF({
          rechnungsnummer,
          rechnungs_datum: rechnungsDatum,
          faellig_am: faelligAm,
          betreff,
          empfaenger_name: name,
          empfaenger_firma: firma,
          empfaenger_adresse: adresse,
          empfaenger_email: email,
          items,
          mwst_prozent: mwst,
          company,
          returnBase64: true,
        })) as string;
        const base64 = dataUri.split(",")[1];
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const filename = `Rechnung_${rechnungsnummer.replace(/[^\w.-]+/g, "_")}.pdf`;
        const filePath = `manuell/${billId}/${filename}`;
        const { error: upErr } = await supabase.storage
          .from("bills")
          .upload(filePath, new Blob([bytes], { type: "application/pdf" }), {
            contentType: "application/pdf",
            upsert: true,
          });
        if (!upErr) {
          await (supabase.from as any)("bills").update({ file_path: filePath, filename }).eq("id", billId);
        }
      } catch { /* PDF-Ablage optional – Rechnung ist gespeichert */ }

      setSavedBillId(billId);
      toast({ description: "Rechnung gespeichert." });
      return billId;
    } catch (e: any) {
      toast({ description: e.message || "Fehler beim Speichern", variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePdf() {
    const err = validate();
    if (err) { toast({ description: err, variant: "destructive" }); return; }
    await exportManualBillPDF({
      rechnungsnummer,
      rechnungs_datum: rechnungsDatum,
      faellig_am: faelligAm,
      betreff,
      empfaenger_name: name,
      empfaenger_firma: firma,
      empfaenger_adresse: adresse,
      empfaenger_email: email,
      items: buildItems(),
      mwst_prozent: mwst,
      company,
    });
  }

  async function handleEmail() {
    if (!email) { toast({ description: "Empfänger-E-Mail fehlt", variant: "destructive" }); return; }
    const err = validate();
    if (err) { toast({ description: err, variant: "destructive" }); return; }
    const billId = savedBillId || await handleSave();
    if (!billId) return;

    const pdfBase64 = (await exportManualBillPDF({
      rechnungsnummer,
      rechnungs_datum: rechnungsDatum,
      faellig_am: faelligAm,
      betreff,
      empfaenger_name: name,
      empfaenger_firma: firma,
      empfaenger_adresse: adresse,
      empfaenger_email: email,
      items: buildItems(),
      mwst_prozent: mwst,
      company,
      returnBase64: true,
    })) as string;

    const { error } = await supabase.functions.invoke("send-manual-invoice", {
      body: {
        to: email,
        rechnungsnummer,
        empfaenger_name: name,
        betreff,
        pdfBase64,
        pdfFilename: `Rechnung_${rechnungsnummer}.pdf`,
      },
    });
    if (error) {
      toast({ description: "E-Mail konnte nicht gesendet werden.", variant: "destructive" });
    } else {
      toast({ description: `Rechnung an ${email} gesendet.` });
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav("/admin/finanzen")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-bold">Manuelle Rechnung erstellen</h1>
      </div>

      {/* Empfänger + Metadaten */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Empfänger</h2>
          <div>
            <Label>Bestehender Kunde (optional)</Label>
            <Select value={selCustomerId} onValueChange={setSelCustomerId}>
              <SelectTrigger><SelectValue placeholder="Freitext-Empfänger" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_frei">Freitext-Empfänger</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.vorname, c.name].filter(Boolean).join(" ")}{c.firma ? ` – ${c.firma}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Firma</Label>
            <Input value={firma} onChange={e => setFirma(e.target.value)} />
          </div>
          <div>
            <Label>Adresse</Label>
            <Textarea value={adresse} onChange={e => setAdresse(e.target.value)} rows={3} placeholder={"Strasse Nr.\nPLZ Ort\nLand"} />
          </div>
          <div>
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Rechnung</h2>
          <div>
            <Label>Rechnungsnummer</Label>
            <Input value={rechnungsnummer} onChange={e => setRechnungsnummer(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rechnungsdatum</Label>
              <Input type="date" value={rechnungsDatum} onChange={e => setRechnungsDatum(e.target.value)} />
            </div>
            <div>
              <Label>Fällig am</Label>
              <Input type="date" value={faelligAm} onChange={e => setFaelligAm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Betreff / Beschreibung (optional)</Label>
            <Input value={betreff} onChange={e => setBetreff(e.target.value)} />
          </div>
          <div>
            <Label>MwSt</Label>
            <Select value={String(mwst)} onValueChange={v => setMwst(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MWST_OPTIONS.map(o => <SelectItem key={o} value={String(o)}>{o}%</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Positionen</h2>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Position
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-[38%]">Beschreibung</th>
                <th className="text-right px-3 py-2 w-[10%]">Menge</th>
                <th className="text-left px-3 py-2 w-[12%]">Einheit</th>
                <th className="text-right px-3 py-2 w-[15%]">Einzelpreis</th>
                <th className="text-right px-3 py-2 w-[15%]">Total</th>
                <th className="w-[10%]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const total = (Number(r.menge) || 0) * (Number(r.einzelpreis_chf) || 0);
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-2">
                      <Input value={r.beschreibung} onChange={e => updateRow(i, { beschreibung: e.target.value })} placeholder="Leistung / Artikel" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" step="0.01" className="text-right" value={r.menge}
                        onChange={e => updateRow(i, { menge: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={r.einheit} onChange={e => updateRow(i, { einheit: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" step="0.01" className="text-right" value={r.einzelpreis_chf}
                        onChange={e => updateRow(i, { einzelpreis_chf: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">CHF {fmtCHF(total)}</td>
                    <td className="px-2 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border p-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span>CHF {fmtCHF(totals.zwischensumme)}</span></div>
            {mwst > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">MwSt ({mwst}%)</span><span>CHF {fmtCHF(totals.mwstBetrag)}</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-border text-base font-bold">
              <span>Gesamt</span><span>CHF {fmtCHF(totals.gesamt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={handlePdf}><FileDown className="w-4 h-4 mr-2" /> PDF generieren</Button>
        <Button variant="outline" onClick={handleEmail} disabled={!email}><Mail className="w-4 h-4 mr-2" /> Per E-Mail senden</Button>
        <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-2" /> {saving ? "Speichern…" : "Rechnung speichern"}</Button>
      </div>
    </div>
  );
}
