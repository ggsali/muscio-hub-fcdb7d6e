import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, FileText, Send, Plus, X, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateKiOfferte, sendKiOfferteMail, type KiPosition } from "@/lib/kiOfferte.functions";
import { exportOfferPositionsPDF } from "@/lib/pdfOfferPositionsExport";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { useSettings } from "@/contexts/SettingsContext";

interface Kunde {
  id: string;
  name: string;
  vorname: string | null;
  email: string | null;
  telefon: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  firma: string | null;
}

interface FilamentRow {
  name: string;
  material: string | null;
  farbe: string | null;
  verkaufspreis_pro_g: number | null;
  preis_pro_kg: number | null;
}

const KiOffertePage = () => {
  const { company } = useCompanySettings();
  const { settings } = useSettings();
  const generate = useServerFn(generateKiOfferte);
  const sendMail = useServerFn(sendKiOfferteMail);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [positionen, setPositionen] = useState<KiPosition[]>([]);
  const [rabattProzent, setRabattProzent] = useState(0);
  const [mwstProzent, setMwstProzent] = useState(0);
  const [gueltigkeitsdauer, setGueltigkeitsdauer] = useState("30 Tage");
  const [zahlungsbedingungen, setZahlungsbedingungen] = useState(
    "Zahlung innerhalb 30 Tagen nach Rechnungsdatum.",
  );
  const [titel, setTitel] = useState("");
  const [notiz, setNotiz] = useState("");
  const [showPreise, setShowPreise] = useState(false);

  const [kundenSearch, setKundenSearch] = useState("");
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [selectedKunde, setSelectedKunde] = useState<Kunde | null>(null);

  const [filamente, setFilamente] = useState<FilamentRow[]>([]);

  useEffect(() => {
    supabase
      .from("filaments")
      .select("name, material, farbe, verkaufspreis_pro_g, preis_pro_kg")
      .eq("aktiv", true)
      .order("material")
      .then(({ data }) => setFilamente((data as FilamentRow[]) || []));
  }, []);

  useEffect(() => {
    if (kundenSearch.trim().length < 2) {
      setKunden([]);
      return;
    }
    const term = kundenSearch.trim().replace(/[%,]/g, "");
    let active = true;
    supabase
      .from("customers")
      .select("id, name, vorname, email, telefon, strasse, hausnummer, plz, ort, firma")
      .or(`name.ilike.%${term}%,vorname.ilike.%${term}%,firma.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(6)
      .then(({ data }) => {
        if (active) setKunden((data as Kunde[]) || []);
      });
    return () => {
      active = false;
    };
  }, [kundenSearch]);

  const materialPreis = (f: FilamentRow) =>
    f.verkaufspreis_pro_g ? Number(f.verkaufspreis_pro_g) : (Number(f.preis_pro_kg) / 1000) * 2.5;

  const preise = useMemo(
    () => ({
      setup_pauschale: Number(settings.setup_pauschale) || 20,
      maschinenzeit_pro_h: Number(settings.maschinenzeit_pro_h) || 3,
      nachbearbeitung_pro_h: Number(settings.nachbearbeitung_pro_h) || 45,
      konstruktion_pro_h: Number(settings.konstruktion_pro_h) || 80,
      filamente: filamente.map((f) => ({
        name: f.name,
        material: f.material,
        farbe: f.farbe,
        preis_pro_g: Number(materialPreis(f).toFixed(4)) || 0,
      })),
    }),
    [settings, filamente],
  );

  const zwischensumme = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0);
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const mwstBetrag = (zwischensumme - rabattBetrag) * (mwstProzent / 100);
  const gesamttotal = zwischensumme - rabattBetrag + mwstBetrag;

  const kundenName = selectedKunde
    ? `${selectedKunde.vorname || ""} ${selectedKunde.name || ""}`.trim()
    : "";

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Bitte Beschreibung eingeben");
      return;
    }
    setLoading(true);
    try {
      const result = await generate({ data: { prompt: prompt.trim(), kundenName, preise } });
      setTitel(result.titel);
      setPositionen(result.positionen);
      setRabattProzent(result.rabatt_prozent);
      setMwstProzent(result.mwst_prozent);
      setGueltigkeitsdauer(result.gueltigkeitsdauer);
      setZahlungsbedingungen(result.zahlungsbedingungen);
      setNotiz(result.notiz);
      toast.success("Offerte generiert ✓");
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const updatePosition = (i: number, field: keyof KiPosition, value: string) => {
    setPositionen((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? {
              ...p,
              [field]:
                field === "menge" || field === "einzelpreis" ? Number(value) || 0 : value,
            }
          : p,
      ),
    );
  };

  const removePosition = (i: number) => setPositionen((prev) => prev.filter((_, idx) => idx !== i));

  const addPosition = () =>
    setPositionen((prev) => [
      ...prev,
      { bezeichnung: "Neue Position", beschreibung: "", menge: 1, einheit: "Stück", einzelpreis: 0 },
    ]);

  const buildPdfProps = (returnBase64: boolean) => {
    const adresseParts: string[] = [];
    if (selectedKunde?.strasse || selectedKunde?.hausnummer) {
      adresseParts.push(`${selectedKunde.strasse || ""} ${selectedKunde.hausnummer || ""}`.trim());
    }
    if (selectedKunde?.plz || selectedKunde?.ort) {
      adresseParts.push(`${selectedKunde.plz || ""} ${selectedKunde.ort || ""}`.trim());
    }

    const notizTeile = [
      notiz.trim(),
      gueltigkeitsdauer.trim() ? `Gültigkeit: ${gueltigkeitsdauer.trim()}` : "",
      zahlungsbedingungen.trim(),
      mwstProzent > 0 ? `Inkl. MwSt ${mwstProzent}% (CHF ${mwstBetrag.toFixed(2)})` : "",
    ].filter(Boolean);

    return {
      orderId: `KI-${Date.now().toString(36).toUpperCase()}`,
      datum: new Date().toISOString().split("T")[0],
      orderName: titel || "KI-Offerte",
      beschreibung: titel || "KI-Offerte",
      offerNote: notizTeile.join("\n"),
      positions: positionen.map((p, i) => ({
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        preis_pro_einheit: p.einzelpreis,
        notiz: p.beschreibung,
        position_order: i,
      })),
      total: gesamttotal,
      discountPercent: rabattProzent,
      company,
      customerName: kundenName || undefined,
      customerFirma: selectedKunde?.firma || undefined,
      customerEmail: selectedKunde?.email || undefined,
      customerTelefon: selectedKunde?.telefon || undefined,
      customerAdresse: adresseParts.join("\n") || undefined,
      returnBase64,
    };
  };

  const handlePreview = async () => {
    if (positionen.length === 0) {
      toast.error("Keine Positionen vorhanden");
      return;
    }
    await exportOfferPositionsPDF(buildPdfProps(false));
  };

  const handleSend = async () => {
    if (!selectedKunde?.email) {
      toast.error("Bitte Kunden mit E-Mail auswählen");
      return;
    }
    if (positionen.length === 0) {
      toast.error("Keine Positionen vorhanden");
      return;
    }
    setSending(true);
    try {
      const result = await exportOfferPositionsPDF(buildPdfProps(true));
      if (!result || !("base64" in result)) throw new Error("PDF konnte nicht erstellt werden");
      const base64 = result.base64.includes(",") ? result.base64.split(",")[1] : result.base64;
      await sendMail({
        data: {
          to: selectedKunde.email,
          customerName: kundenName || undefined,
          titel: titel || "KI-Offerte",
          total: Number(gesamttotal.toFixed(2)),
          gueltigkeitsdauer,
          pdfBase64: base64,
          pdfFilename: result.filename,
        },
      });
      toast.success("Offerte gesendet ✓");
    } catch (e) {
      toast.error("Fehler beim Senden: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            KI-Offerte erstellen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beschreibe was verrechnet werden soll – die KI erstellt die Offerte mit deinen aktuellen Preisen.
          </p>
        </div>
        {positionen.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} className="gap-2">
              <FileText className="w-4 h-4" /> PDF Vorschau
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Offerte senden
            </Button>
          </div>
        )}
      </div>

      {/* KUNDE */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold mb-3">Kunde auswählen (optional)</h3>
        {!selectedKunde ? (
          <>
            <Input
              value={kundenSearch}
              onChange={(e) => setKundenSearch(e.target.value)}
              placeholder="Kundenname, E-Mail oder Firma suchen..."
              className="text-base"
            />
            {kunden.length > 0 && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden">
                {kunden.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => {
                      setSelectedKunde(k);
                      setKundenSearch("");
                      setKunden([]);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b border-border last:border-0 transition-colors"
                  >
                    <span className="font-medium">
                      {k.vorname} {k.name}
                    </span>
                    {k.firma && <span className="text-muted-foreground"> – {k.firma}</span>}
                    {k.email && <span className="block text-xs text-muted-foreground">{k.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start justify-between bg-muted/40 rounded-xl p-4">
            <div>
              <p className="font-medium">
                {selectedKunde.vorname} {selectedKunde.name}
              </p>
              {selectedKunde.firma && (
                <p className="text-sm text-muted-foreground">{selectedKunde.firma}</p>
              )}
              <p className="text-sm text-muted-foreground">{selectedKunde.email}</p>
            </div>
            <button
              onClick={() => setSelectedKunde(null)}
              className="text-muted-foreground hover:text-destructive ml-4"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* KI PROMPT */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Was soll verrechnet werden?
        </h3>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="z.B.: 2x PLA-Druck à 150g Standard-Qualität in Schwarz, 3 Stunden Konstruktionszeit für eine Halterung, Express-Aufpreis 20%, Versand Post Priority"
          className="min-h-[140px] text-base resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) handleGenerate();
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <button
            onClick={() => setShowPreise(!showPreise)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPreise ? "rotate-180" : ""}`} />
            Aktuelle Preise anzeigen ({filamente.length} Materialien geladen)
          </button>
          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "KI generiert..." : "Offerte generieren"}
          </Button>
        </div>

        {showPreise && (
          <div className="mt-3 bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-2">Preise aus deinen Einstellungen:</p>
            <p>
              Setup-Pauschale: <strong>CHF {preise.setup_pauschale}</strong>
            </p>
            <p>
              Maschinenzeit: <strong>CHF {preise.maschinenzeit_pro_h}/h</strong>
            </p>
            <p>
              Nachbearbeitung: <strong>CHF {preise.nachbearbeitung_pro_h}/h</strong>
            </p>
            <p>
              Konstruktion: <strong>CHF {preise.konstruktion_pro_h}/h</strong>
            </p>
            {preise.filamente.length > 0 && (
              <>
                <p className="font-semibold text-foreground mt-2 mb-1">Materialien:</p>
                {preise.filamente.map((f) => (
                  <p key={f.name}>
                    {f.name}: <strong>CHF {f.preis_pro_g.toFixed(3)}/g</strong>
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* POSITIONEN */}
      {positionen.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{titel || "Positionen"}</h3>
            <Button variant="outline" size="sm" onClick={addPosition} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Position hinzufügen
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2 px-3 font-medium">Bezeichnung</th>
                  <th className="text-right py-2 px-3 font-medium w-20">Menge</th>
                  <th className="text-right py-2 px-3 font-medium w-24">Einheit</th>
                  <th className="text-right py-2 px-3 font-medium w-32">Einzelpreis</th>
                  <th className="text-right py-2 px-3 font-medium w-28">Total</th>
                  <th className="py-2 px-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((pos, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <Input
                        value={pos.bezeichnung}
                        onChange={(e) => updatePosition(i, "bezeichnung", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent px-0 focus-visible:ring-0 font-medium"
                      />
                      <Input
                        value={pos.beschreibung}
                        onChange={(e) => updatePosition(i, "beschreibung", e.target.value)}
                        placeholder="Beschreibung..."
                        className="h-6 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 text-muted-foreground mt-0.5"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        value={pos.menge}
                        onChange={(e) => updatePosition(i, "menge", e.target.value)}
                        className="h-7 text-sm w-16 text-right ml-auto"
                        min={1}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        value={pos.einheit}
                        onChange={(e) => updatePosition(i, "einheit", e.target.value)}
                        className="h-7 text-sm w-20 text-right ml-auto"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-muted-foreground">CHF</span>
                        <Input
                          type="number"
                          value={pos.einzelpreis}
                          onChange={(e) => updatePosition(i, "einzelpreis", e.target.value)}
                          className="h-7 text-sm w-20 text-right"
                          step="0.05"
                          min={0}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      CHF {(pos.menge * pos.einzelpreis).toFixed(2)}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => removePosition(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUMMEN */}
          <div className="flex flex-col items-end gap-1.5 mt-4 pt-4 border-t border-border text-sm">
            <div className="flex justify-between w-64">
              <span className="text-muted-foreground">Zwischensumme</span>
              <span className="font-mono">CHF {zwischensumme.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between w-64">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rabatt</span>
                <Input
                  type="number"
                  value={rabattProzent}
                  onChange={(e) => setRabattProzent(Number(e.target.value) || 0)}
                  className="h-6 w-14 text-xs text-right"
                  min={0}
                  max={100}
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
              <span className={`font-mono ${rabattBetrag > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                - CHF {rabattBetrag.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between w-64">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">MwSt</span>
                <Input
                  type="number"
                  value={mwstProzent}
                  onChange={(e) => setMwstProzent(Number(e.target.value) || 0)}
                  className="h-6 w-14 text-xs text-right"
                  min={0}
                  max={100}
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
              <span className="font-mono">CHF {mwstBetrag.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-64 font-bold text-base border-t border-border pt-2 mt-1">
              <span>Total</span>
              <span className="font-mono text-primary">CHF {gesamttotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* KONDITIONEN */}
      {positionen.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Konditionen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Gültigkeitsdauer</label>
              <Input
                value={gueltigkeitsdauer}
                onChange={(e) => setGueltigkeitsdauer(e.target.value)}
                className="text-base"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Zahlungsbedingungen</label>
              <Input
                value={zahlungsbedingungen}
                onChange={(e) => setZahlungsbedingungen(e.target.value)}
                className="text-base"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground mb-1.5 block">Bemerkungen (erscheinen auf der Offerte)</label>
              <Textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                className="text-sm"
                rows={2}
              />
            </div>
          </div>
        </div>
      )}

      {/* AKTIONEN UNTEN */}
      {positionen.length > 0 && (
        <div className="flex gap-2 flex-wrap pb-8">
          <Button variant="outline" onClick={handlePreview} className="gap-2">
            <FileText className="w-4 h-4" /> PDF Vorschau
          </Button>
          <Button variant="outline" onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Offerte per Mail senden
          </Button>
        </div>
      )}
    </div>
  );
};

export default KiOffertePage;
