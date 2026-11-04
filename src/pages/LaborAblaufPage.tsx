import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, XCircle, Play, Download, Trophy, Upload, X } from "lucide-react";
import { formatCHF, loadSettings } from "@/lib/calc";
import { loadCompanySettings } from "@/lib/companySettings";
import { filamentFarben } from "@/lib/filamentFarben";
import { infoFromStl, dimsFromObj, type Mass3 } from "@/lib/versandArt";
import { exportOfferPDF } from "@/lib/pdfOfferExport";
import { exportOfferPositionsPDF } from "@/lib/pdfOfferPositionsExport";
import {
  BAUBREITE_MAX_MM, sliceImLabor, wurdeEingereiht, kurz, vergleiche, ladeLaborPreisKonfig, laborPreis, standardInfill,
  base64ZuBlobUrl, dateiZuBase64, type SliceKurz, type Gewinner, type PreisErgebnis, type LaborPreisKonfig,
} from "@/lib/laborAblauf";

/* Labor-Ablauf: spielt Analyse, Slice, Ausrichtungsvergleich, Einschätzung, Preis und Offerte-Vorschau durch.
 * Verboten im Labor: orders, inquiries, customers, invoices, calculator_uploads, calc_events; submit-inquiry, send-email,
 * send-transactional-email, notify-*, slice-decision; enqueue=true. Gespeichert wird nur in lab_jobs. */

const QUALITAETEN = [0.08, 0.12, 0.16, 0.2];
const ERLAUBT = [".stl", ".3mf", ".obj"];
const MAX_MB = 50;

type StepStatus = "wartet" | "laeuft" | "fertig" | "fehler";
interface Step { status: StepStatus; text?: string; fehler?: string }
const leer = (): Step => ({ status: "wartet" });

interface Filament { id: string; name: string; material: string; farbe: string | null; farben: unknown; verkaufspreis_pro_g: number; dichte_g_cm3: number | null }

interface AnalyseDaten {
  dims: Mass3 | null;
  triangles: number | null;
  volumeCm3: number | null;
  groesserAlsBett: boolean;
  teileGeschaetzt: number | null;
  ueberhangVorher: number | null;
  ueberhangNachher: number | null;
  ausrichtung: string | null;
  warnung: string | null;
}

interface Run {
  id: string;
  file: File;
  analyse: Step; slice: Step; vergleich: Step; einschaetzung: Step; preis: Step;
  a?: AnalyseDaten;
  mit?: SliceKurz;
  ohne?: SliceKurz;
  sieger?: { gewinner: Gewinner; grund: string };
  einschaetzungDaten?: { level: string; reasons: string[]; printer: string | null };
  preisDaten?: PreisErgebnis & { gramm: number; druckzeitMin: number; variante: "mit" | "ohne"; menge: number };
  jobId?: string;
}

const fehlerText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;

function StepZeile({ titel, step }: { titel: string; step: Step }) {
  const icon =
    step.status === "fertig" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    step.status === "fehler" ? <XCircle className="h-4 w-4 text-destructive" /> :
    step.status === "laeuft" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
    <Circle className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="flex items-start gap-2 py-1">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{titel} <span className="text-xs font-normal text-muted-foreground">{step.status}</span></div>
        {step.text && <div className="text-xs text-muted-foreground">{step.text}</div>}
        {step.fehler && <div className="text-xs text-destructive font-medium">{step.fehler}</div>}
      </div>
    </div>
  );
}

export default function LaborAblaufPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [filamente, setFilamente] = useState<Filament[]>([]);
  const [filamentId, setFilamentId] = useState("");
  const [farbe, setFarbe] = useState("");
  const [qualitaet, setQualitaet] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [menge, setMenge] = useState(1);
  const [testkunde, setTestkunde] = useState("");
  const [konfig, setKonfig] = useState<LaborPreisKonfig | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [offerte, setOfferte] = useState<Step>(leer());
  const [pdfTeile, setPdfTeile] = useState<{ url: string; name: string } | null>(null);
  const [pdfPos, setPdfPos] = useState<{ url: string; name: string } | null>(null);
  const [gesamt, setGesamt] = useState<{ teile: number; setup: number; total: number } | null>(null);
  const [eingereiht, setEingereiht] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (supabase.from as any)("filaments")
      .select("id, name, material, farbe, farben, verkaufspreis_pro_g, dichte_g_cm3, aktiv")
      .eq("aktiv", true)
      .order("name")
      .then(({ data, error }: any) => {
        if (error) { toast.error(`Filament-Bibliothek: ${error.message}`); return; }
        const pla = ((data ?? []) as Filament[]).filter((f) => /pla/i.test(f.material ?? "") || /pla/i.test(f.name ?? ""));
        setFilamente(pla);
        if (pla[0]) setFilamentId(pla[0].id);
      });
    ladeLaborPreisKonfig().then((k) => { setKonfig(k); setInfill(standardInfill(k.presets, 0.2)); }).catch((e) => toast.error(`Preisgrundlagen: ${fehlerText(e)}`));
  }, []);

  const filament = filamente.find((f) => f.id === filamentId) ?? null;
  const farben = useMemo(() => filamentFarben(filament), [filament]);
  useEffect(() => { setFarbe(farben[0]?.name ?? ""); }, [filamentId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (konfig) setInfill(standardInfill(konfig.presets, qualitaet)); }, [qualitaet, konfig]);
  useEffect(() => () => { if (pdfTeile) URL.revokeObjectURL(pdfTeile.url); if (pdfPos) URL.revokeObjectURL(pdfPos.url); }, [pdfTeile, pdfPos]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!ERLAUBT.includes(ext)) { toast.error(`${f.name}: Dateityp ${ext || "?"} nicht erlaubt (STL, 3MF, OBJ)`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name}: grösser als ${MAX_MB} MB`); continue; }
      ok.push(f);
    }
    setFiles((x) => [...x, ...ok]);
  };

  const patch = (id: string, fn: (r: Run) => Partial<Run>) =>
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...fn(r) } : r)));

  /* ----------------------------- Schritt a) Analyse ----------------------------- */
  async function analysiere(file: File): Promise<AnalyseDaten> {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    let dims: Mass3 | null = null;
    let triangles: number | null = null;
    let volumeCm3: number | null = null;
    let ueberhangVorher: number | null = null;
    let ueberhangNachher: number | null = null;
    let ausrichtung: string | null = null;
    const hinweise: string[] = [];

    if (ext === ".stl") {
      const info = infoFromStl(await file.arrayBuffer());
      if (!info) throw new Error("Datei defekt: kein lesbares STL (keine gültigen Dreiecke gefunden)");
      dims = info.dims; triangles = info.triangles;
      if (file.size > 6.5 * 1024 * 1024) {
        hinweise.push("Detailanalyse übersprungen: Datei grösser als 6.5 MB (Limit der Serveranalyse)");
      } else {
        const { data, error } = await supabase.functions.invoke("analyze-stl", {
          body: {
            stlBase64: await dateiZuBase64(file), fileName: file.name, material: "PLA",
            pricePerGram: filament?.verkaufspreis_pro_g ?? 0.055, qualityKey: "standard", layerHeight: qualitaet, infill,
            speedFactor: 1, quantity: menge, maschinenzeit: konfig?.maschinenRate ?? 3, setupFee: konfig?.setupPauschale ?? 20,
            minPrice: konfig?.minPrice ?? 5, minuten_pro_gramm: 2.5, overhang_schwellwert: 30, komplexitaets_aufschlag: 20, versandkosten: 0,
          },
        });
        if (error || !data || (data as any).error) {
          hinweise.push(`Serveranalyse fehlgeschlagen (${error?.message ?? (data as any)?.error ?? "unbekannt"}): Volumen und Überhang unbekannt`);
        } else {
          const d = data as any;
          volumeCm3 = Number(d.volumeCm3) || null;
          ueberhangVorher = d.orientierung_original_ueberhang ?? null;
          ueberhangNachher = d.orientierung_beste_ueberhang ?? null;
          ausrichtung = d.orientierung ?? null;
          if (!dims && d.bbox) dims = [Number(d.bbox.x), Number(d.bbox.y), Number(d.bbox.z)];
        }
      }
    } else if (ext === ".obj") {
      dims = dimsFromObj(await file.text());
      if (!dims) throw new Error("Datei defekt: kein lesbares OBJ (keine Eckpunkte gefunden)");
      hinweise.push("OBJ: Volumen, Dreiecke und Überhang werden nur bei STL ermittelt");
    } else {
      hinweise.push("3MF: Abmessungen und Volumen werden vor dem Slicen nicht ermittelt (nur bei STL und OBJ)");
    }
    const maxDim = dims ? Math.max(...dims) : 0;
    const gross = maxDim > BAUBREITE_MAX_MM;
    return {
      dims, triangles, volumeCm3, groesserAlsBett: gross,
      teileGeschaetzt: gross ? Math.min(4, Math.ceil(maxDim / BAUBREITE_MAX_MM)) : null,
      ueberhangVorher, ueberhangNachher, ausrichtung,
      warnung: hinweise.length ? hinweise.join(" · ") : null,
    };
  }

  /* ------------------------------ ein Modell durchspielen ------------------------------ */
  async function lauf(file: File, runId: string): Promise<{ run: Partial<Run>; status: string; fehler: string | null; ergebnis: Record<string, unknown> }> {
    const set = (p: Partial<Run>) => patch(runId, () => p);
    const fehler: string[] = [];
    const lokal: Partial<Run> = {};
    const hold = (p: Partial<Run>) => { Object.assign(lokal, p); set(p); };

    // a) Analyse
    hold({ analyse: { status: "laeuft" } });
    let a: AnalyseDaten | undefined;
    try {
      a = await analysiere(file);
      const t: string[] = [];
      if (a.dims) t.push(`${a.dims.map((x) => x.toFixed(1)).join(" × ")} mm`);
      if (a.volumeCm3) t.push(`${a.volumeCm3.toFixed(1)} cm³`);
      if (a.triangles) t.push(`${a.triangles.toLocaleString("de-CH")} Dreiecke`);
      t.push(a.groesserAlsBett ? `grösser als ${BAUBREITE_MAX_MM} mm: wird geteilt (ca. ${a.teileGeschaetzt} Teile)` : `passt auf das Druckbett (${BAUBREITE_MAX_MM} mm)`);
      if (a.warnung) t.push(`Hinweis: ${a.warnung}`);
      hold({ a, analyse: { status: "fertig", text: t.join(" · ") } });
    } catch (e) {
      fehler.push(`Analyse: ${fehlerText(e)}`);
      hold({ analyse: { status: "fehler", fehler: fehlerText(e) } });
    }

    // b) Slicen (mit Ausrichtung)
    hold({ slice: { status: "laeuft", text: "Server schneidet mit Auto-Ausrichtung ..." } });
    let mitRes: Awaited<ReturnType<typeof sliceImLabor>> | null = null;
    try {
      mitRes = await sliceImLabor(file, qualitaet, infill, true);
      if (wurdeEingereiht(mitRes)) { setEingereiht(true); throw new Error("UNERWARTET: Der Server hat das Teil eingereiht. Im Labor darf nichts eingereiht werden."); }
      const k = kurz(mitRes);
      hold({ mit: k, slice: { status: "fertig", text: `${hm(k.druckzeitMin)} · ${k.gramm.toFixed(1)} g · ${k.schichten} Schichten · Stützen: ${k.hatStuetzen ? "ja" : "nein"}${k.splitParts ? ` · geteilt in ${k.splitParts} Teile` : ""}` } });
    } catch (e) {
      fehler.push(`Slicen: ${fehlerText(e)}`);
      const msg = fehlerText(e);
      hold({
        slice: { status: "fehler", fehler: msg },
        vergleich: { status: "fehler", fehler: "Nicht möglich, weil das Slicen fehlgeschlagen ist" },
        einschaetzung: { status: "fehler", fehler: "Nicht möglich, weil das Slicen fehlgeschlagen ist" },
        preis: { status: "fehler", fehler: "Nicht möglich, weil das Slicen fehlgeschlagen ist" },
      });
      return { run: lokal, status: "fehler", fehler: fehler.join(" | "), ergebnis: { analyse: lokal.a ?? null, fehler } };
    }

    // c) Ausrichtungsvergleich
    hold({ vergleich: { status: "laeuft", text: "Zweiter Slice ohne Ausrichtung ..." } });
    let gewaehlt: "mit" | "ohne" = "mit";
    try {
      const ohneRes = await sliceImLabor(file, qualitaet, infill, false);
      if (wurdeEingereiht(ohneRes)) { setEingereiht(true); throw new Error("UNERWARTET: Der Server hat das Teil eingereiht. Im Labor darf nichts eingereiht werden."); }
      const ohne = kurz(ohneRes);
      const mit = kurz(mitRes);
      const sieger = vergleiche(mit, ohne);
      if (sieger.gewinner === "ohne") gewaehlt = "ohne";
      hold({
        ohne, sieger,
        vergleich: { status: "fertig", text: sieger.gewinner === "gleich" ? "Beide Varianten gleichwertig" : sieger.gewinner === "unklar" ? sieger.grund : `Besser: ${sieger.gewinner === "mit" ? "mit Auto-Ausrichtung" : "ohne Ausrichtung"}` },
      });
    } catch (e) {
      fehler.push(`Ausrichtungsvergleich: ${fehlerText(e)}`);
      hold({ vergleich: { status: "fehler", fehler: fehlerText(e) } });
    }

    // d) Einschätzung (aus dem nas-Feld des ersten Slice-Ergebnisses)
    if (mitRes.nas) {
      const n = mitRes.nas;
      hold({
        einschaetzungDaten: { level: n.level, reasons: n.reasons, printer: n.printer },
        einschaetzung: { status: "fertig", text: `${n.level}${n.printer ? ` · Drucker-Vorschlag ${n.printer}` : ""}${n.reasons.length ? ` · ${n.reasons.join("; ")}` : ""}` },
      });
    } else {
      fehler.push("Einschätzung: Server lieferte kein nas-Feld");
      hold({ einschaetzung: { status: "fehler", fehler: "Der Server lieferte keine Einschätzung (nas-Feld fehlt)" } });
    }

    // e) Preis (gewählte Variante)
    try {
      if (!filament) throw new Error("Kein Filament gewählt");
      if (!konfig) throw new Error("Preisgrundlagen nicht geladen");
      const k = gewaehlt === "ohne" ? (lokal.ohne as SliceKurz) : (lokal.mit as SliceKurz);
      const p = laborPreis({
        gramm: k.gramm, druckzeitMin: k.druckzeitMin, pricePerGram: Number(filament.verkaufspreis_pro_g) || 0, hasSupport: k.hatStuetzen,
        dims: lokal.a?.dims ?? null, triangles: lokal.a?.triangles ?? null, volumeCm3: lokal.a?.volumeCm3 ?? null,
        splitParts: k.splitParts ?? (lokal.a?.groesserAlsBett ? lokal.a.teileGeschaetzt : null), menge,
      }, konfig);
      hold({
        preisDaten: { ...p, gramm: k.gramm, druckzeitMin: k.druckzeitMin, variante: gewaehlt, menge },
        preis: { status: "fertig", text: `${formatCHF(p.proStueck)} pro Stück · ${formatCHF(p.teilsumme)} für ${menge} Stück (Variante ${gewaehlt === "mit" ? "mit Ausrichtung" : "ohne Ausrichtung"})` },
      });
    } catch (e) {
      fehler.push(`Preis: ${fehlerText(e)}`);
      hold({ preis: { status: "fehler", fehler: fehlerText(e) } });
    }

    return {
      run: lokal,
      status: fehler.length === 0 ? "fertig" : "teilweise",
      fehler: fehler.length ? fehler.join(" | ") : null,
      ergebnis: {
        analyse: lokal.a ?? null, slice: { mit: lokal.mit ?? null, ohne: lokal.ohne ?? null },
        vergleich: lokal.sieger ?? null, einschaetzung: lokal.einschaetzungDaten ?? null,
        preis: lokal.preisDaten ?? null, offerte: null,
      },
    };
  }

  /* --------------------------- Schritt f) Offerte-Vorschau --------------------------- */
  async function baueOfferte(fertig: { name: string; p: NonNullable<Run["preisDaten"]> }[]) {
    if (fertig.length === 0 || !filament || !konfig) throw new Error("Keine bepreisten Teile für die Offerte");
    const [settings, company] = await Promise.all([loadSettings(), loadCompanySettings()]);
    const setup = konfig.setupPauschale;
    const teile = fertig.reduce((s, f) => s + f.p.teilsumme, 0);
    const total = Math.max(teile + setup, konfig.minPrice);
    const datum = new Date().toISOString().slice(0, 10);
    const name = testkunde.trim() || "Testkunde (Labor)";
    const farbtext = farbe || filament.farbe || null;
    const orderId = `LABOR-${Date.now().toString(36).toUpperCase()}`;

    const r1 = await exportOfferPDF({
      orderId, datum, beschreibung: "LABOR-TESTOFFERTE, nicht gültig", customerName: name,
      parts: fertig.map((f, i) => ({
        teilname: f.name, material: filament.name, farbe: farbtext, menge: f.p.menge,
        gewicht_g: f.p.gramm, druckzeit_h: f.p.druckzeitMin / 60, nachbearbeitung_h: f.p.nachbearbeitungMin / 60,
        preis_pro_stueck: f.p.proStueck, preis_total: f.p.teilsumme, filament_verkauf_pro_g: Number(filament.verkaufspreis_pro_g) || 0,
        setup_pauschale_anzahl: i === 0 ? 1 : 0,
      })) as any,
      umsatz_total: total, settings: { ...settings, setup_pauschale: setup }, company, returnBase64: true,
    });
    const r2 = await exportOfferPositionsPDF({
      orderId, datum, orderName: "LABOR-TESTOFFERTE", beschreibung: "Nur Test, nicht gültig", offerNote: "Labor-Vorschau. Kein Versand, keine Bestellung.",
      positions: [
        ...fertig.map((f, i) => ({
          bezeichnung: `${f.name} (${filament.name}${farbtext ? `, ${farbtext}` : ""}, ${qualitaet.toFixed(2)} mm)`,
          menge: f.p.menge, einheit: "Stk.", preis_pro_einheit: Math.round(f.p.proStueck * 100) / 100, notiz: "", position_order: i,
        })),
        { bezeichnung: "Setup-Pauschale", menge: 1, einheit: "Pauschal", preis_pro_einheit: setup, notiz: "", position_order: fertig.length },
      ],
      total, discountPercent: 0, company, customerName: name, returnBase64: true,
    });
    const b1 = (r1 as any)?.base64 as string | undefined;
    const b2 = (r2 as any)?.base64 as string | undefined;
    if (!b1 || !b2) throw new Error("PDF konnte nicht erzeugt werden");
    setPdfTeile({ url: base64ZuBlobUrl(b1), name: `Labor-Offerte-Teile-${orderId}.pdf` });
    setPdfPos({ url: base64ZuBlobUrl(b2), name: `Labor-Offerte-Positionen-${orderId}.pdf` });
    setGesamt({ teile, setup, total });
    return { orderId, total, teile, setup };
  }

  /* ----------------------------------- Start ----------------------------------- */
  const start = async () => {
    if (files.length === 0) { toast.error("Bitte mindestens ein Modell wählen"); return; }
    if (!filament) { toast.error("Bitte ein Filament aus der Bibliothek wählen"); return; }
    if (!konfig) { toast.error("Preisgrundlagen sind noch nicht geladen"); return; }
    setLaeuft(true); setEingereiht(false); setOfferte(leer()); setGesamt(null);
    setPdfTeile(null); setPdfPos(null);
    const neu: Run[] = files.map((f, i) => ({ id: `${Date.now()}-${i}`, file: f, analyse: leer(), slice: leer(), vergleich: leer(), einschaetzung: leer(), preis: leer() }));
    setRuns(neu);

    const einst = {
      material: "PLA", filament: filament.name, filamentId: filament.id, farbe: farbe || null, qualitaet, infill, menge,
      testkunde: testkunde.trim() || null, preisgrundlagen: { maschinenRate: konfig.maschinenRate, nachbearbeitungRate: konfig.nachbearbeitungRate, setupPauschale: konfig.setupPauschale, minPrice: konfig.minPrice },
    };
    const gespeichert: { jobId: string; name: string; p: NonNullable<Run["preisDaten"]> | null; ergebnis: Record<string, unknown> }[] = [];

    for (const r of neu) {
      const res = await lauf(r.file, r.id);
      const { data, error } = await (supabase.from as any)("lab_jobs")
        .insert({ kind: "ablauf", dateiname: r.file.name, einstellungen: einst, ergebnis: res.ergebnis, status: res.status, fehler: res.fehler })
        .select("id").single();
      if (error) toast.error(`Testlauf konnte nicht gespeichert werden (${r.file.name}): ${error.message}`);
      else patch(r.id, () => ({ jobId: data.id }));
      gespeichert.push({ jobId: data?.id, name: r.file.name, p: (res.run.preisDaten as any) ?? null, ergebnis: res.ergebnis });
    }

    // f) Offerte (Vorschau und Download, kein Versand)
    setOfferte({ status: "laeuft", text: "PDF wird erzeugt ..." });
    try {
      const fertig = gespeichert.filter((g) => g.p).map((g) => ({ name: g.name, p: g.p! }));
      const o = await baueOfferte(fertig);
      setOfferte({ status: "fertig", text: `Vorschau erzeugt: Gesamt ${formatCHF(o.total)} (Teile ${formatCHF(o.teile)} + Setup ${formatCHF(o.setup)})` });
      for (const g of gespeichert) {
        if (!g.jobId) continue;
        await (supabase.from as any)("lab_jobs").update({ ergebnis: { ...g.ergebnis, offerte: { erzeugt: true, orderId: o.orderId, total: o.total, teile: fertig.length } } }).eq("id", g.jobId);
      }
    } catch (e) {
      setOfferte({ status: "fehler", fehler: fehlerText(e) });
      for (const g of gespeichert) {
        if (!g.jobId) continue;
        await (supabase.from as any)("lab_jobs").update({ ergebnis: { ...g.ergebnis, offerte: { erzeugt: false, fehler: fehlerText(e) } } }).eq("id", g.jobId);
      }
    }
    setLaeuft(false);
    toast.success("Ablauf beendet. Der Testlauf steht unter «Testläufe».");
  };

  const download = (p: { url: string; name: string }) => {
    const a = document.createElement("a");
    a.href = p.url; a.download = p.name; a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Ablauf</h1>
        <p className="text-sm text-muted-foreground">Spielt den Automatik-Ablauf als reinen Test durch. Es werden keine Kundendaten gelesen oder geschrieben, keine Mails gesendet und nichts in die Druckerqueue gestellt.</p>
      </div>

      {eingereiht && (
        <div className="rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm font-medium p-3">
          Achtung: Der Server meldet einen Queue-Eintrag, obwohl das Labor nie einreiht. Bitte auf dem Server prüfen (SimplyPrint-Queue) und den Slicer-Dienst kontrollieren.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <div className="text-sm font-medium mb-1">Modelle (STL, 3MF, OBJ)</div>
          <input ref={fileRef} type="file" multiple accept=".stl,.3mf,.obj" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={laeuft}><Upload className="h-4 w-4 mr-1" /> Dateien wählen</Button>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {f.name} ({(f.size / 1048576).toFixed(1)} MB)
                  {!laeuft && <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Material</div>
            <Input value="PLA" disabled />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Filament (Bibliothek)</div>
            <select value={filamentId} onChange={(e) => setFilamentId(e.target.value)} disabled={laeuft} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              {filamente.length === 0 && <option value="">Kein PLA-Filament gefunden</option>}
              {filamente.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Farbe</div>
            <select value={farbe} onChange={(e) => setFarbe(e.target.value)} disabled={laeuft || farben.length === 0} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              {farben.length === 0 && <option value="">Keine Farbe hinterlegt</option>}
              {farben.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Qualität (Schichthöhe)</div>
            <select value={qualitaet} onChange={(e) => setQualitaet(Number(e.target.value))} disabled={laeuft} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              {QUALITAETEN.map((q) => <option key={q} value={q}>{q.toFixed(2)} mm</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Füllgrad %</div>
            <Input type="number" min={5} max={100} value={infill} onChange={(e) => setInfill(Math.min(100, Math.max(5, Number(e.target.value) || 5)))} disabled={laeuft} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Menge pro Modell</div>
            <Input type="number" min={1} max={500} value={menge} onChange={(e) => setMenge(Math.max(1, Math.floor(Number(e.target.value) || 1)))} disabled={laeuft} />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Testkunde (Freitext, nur für den Testlauf und die PDF-Vorschau)</div>
            <Input value={testkunde} onChange={(e) => setTestkunde(e.target.value)} placeholder="z. B. Muster AG" disabled={laeuft} />
          </div>
        </div>

        <Button onClick={start} disabled={laeuft || files.length === 0 || !filament || !konfig}>
          {laeuft ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Ablauf starten
        </Button>
      </div>

      {runs.map((r) => (
        <div key={r.id} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold truncate">{r.file.name}</div>
            {r.jobId && <span className="text-xs text-muted-foreground">gespeichert</span>}
          </div>
          <div className="divide-y">
            <StepZeile titel="a) Analyse" step={r.analyse} />
            <StepZeile titel="b) Slicen auf dem Server" step={r.slice} />
            <StepZeile titel="c) Ausrichtungsvergleich" step={r.vergleich} />
            <StepZeile titel="d) Einschätzung einfach / kompliziert" step={r.einschaetzung} />
            <StepZeile titel="e) Preis" step={r.preis} />
          </div>

          {r.mit && r.ohne && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-md">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr><th className="text-left p-2"> </th><th className="text-left p-2">Mit Auto-Ausrichtung</th><th className="text-left p-2">Ohne Ausrichtung</th></tr>
                </thead>
                <tbody>
                  {([
                    ["Druckzeit", (k: SliceKurz) => hm(k.druckzeitMin)],
                    ["Filament", (k: SliceKurz) => `${k.gramm.toFixed(1)} g`],
                    ["Stützen", (k: SliceKurz) => (k.hatStuetzen ? "ja" : "nein")],
                    ["Stützmenge", (k: SliceKurz) => (k.stuetzGramm != null ? `${k.stuetzGramm.toFixed(1)} g` : "vom Server nicht geliefert")],
                    ["Schichten", (k: SliceKurz) => String(k.schichten)],
                  ] as [string, (k: SliceKurz) => string][]).map(([l, f]) => (
                    <tr key={l} className="border-t">
                      <td className="p-2 text-muted-foreground">{l}</td>
                      <td className="p-2">{f(r.mit!)}</td>
                      <td className="p-2">{f(r.ohne!)}</td>
                    </tr>
                  ))}
                  <tr className="border-t">
                    <td className="p-2 text-muted-foreground">Überhang laut Analyse</td>
                    <td className="p-2" colSpan={2}>
                      {r.a?.ueberhangVorher != null
                        ? `vorher ${r.a.ueberhangVorher} % → nachher ${r.a.ueberhangNachher} % (beste Ausrichtung: ${r.a.ausrichtung ?? "unbekannt"}; Schätzung der Serveranalyse, nur STL)`
                        : "nicht verfügbar"}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="p-2 font-medium">Ergebnis</td>
                    <td className="p-2" colSpan={2}>
                      {r.sieger && (
                        <span className="inline-flex items-center gap-1">
                          {(r.sieger.gewinner === "mit" || r.sieger.gewinner === "ohne") && <Trophy className="h-4 w-4 text-amber-500" />}
                          {r.sieger.gewinner === "mit" ? "Besser: mit Auto-Ausrichtung. " : r.sieger.gewinner === "ohne" ? "Besser: ohne Ausrichtung. " : ""}
                          {r.sieger.grund}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {r.preisDaten && (
            <div className="text-sm grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                ["Material", r.preisDaten.material], ["Maschinenzeit", r.preisDaten.maschine],
                [`Nachbearbeitung (${r.preisDaten.nachbearbeitungMin.toFixed(0)} min)`, r.preisDaten.nachbearbeitung],
                ["Teilung", r.preisDaten.teilung], ["Pro Stück", r.preisDaten.proStueck],
              ] as [string, number][]).map(([l, v]) => (
                <div key={l} className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">{l}</div><div className="font-semibold">{formatCHF(v)}</div></div>
              ))}
            </div>
          )}
        </div>
      ))}

      {runs.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <StepZeile titel="f) Offerte (nur Vorschau und Download, kein Versand)" step={offerte} />
          {gesamt && (
            <div className="text-sm text-muted-foreground">Teile {formatCHF(gesamt.teile)} + Setup {formatCHF(gesamt.setup)} = <span className="font-semibold text-foreground">{formatCHF(gesamt.total)}</span> (ohne Versand)</div>
          )}
          {(pdfTeile || pdfPos) && (
            <div className="grid lg:grid-cols-2 gap-4">
              {[["Offerte mit Teilen", pdfTeile], ["Offerte mit Positionen", pdfPos]].map(([titel, p]) => p && (
                <div key={titel as string} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{titel as string}</div>
                    <Button size="sm" variant="outline" onClick={() => download(p as { url: string; name: string })}><Download className="h-4 w-4 mr-1" /> PDF laden</Button>
                  </div>
                  <iframe src={(p as { url: string }).url} title={titel as string} className="w-full h-[520px] rounded-md border bg-white" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
