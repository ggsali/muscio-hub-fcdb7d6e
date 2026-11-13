import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImagePlus, Loader2, Printer, Save, Trash2 } from "lucide-react";
import {
  LAENDER, LEERE_ADRESSE, adressZeilen, absenderZeilen, findLand, type LabelAdresse,
} from "@/lib/labelAddress";

const FORMATE = {
  a6hoch: { label: "A6 hochkant (105 × 148 mm)", w: 105, h: 148 },
  a6quer: { label: "A6 quer (148 × 105 mm)", w: 148, h: 105 },
  p10x15: { label: "Thermo 100 × 150 mm", w: 100, h: 150 },
} as const;
type FormatKey = keyof typeof FORMATE;

const SENDER_KEY = "label_absender";
const FELDER: { k: keyof LabelAdresse; label: string; wide?: boolean }[] = [
  { k: "name", label: "Name" },
  { k: "firma", label: "Firma" },
  { k: "zusatz", label: "Zusatz (c/o, Abteilung)", wide: true },
  { k: "strasse", label: "Strasse und Nr. / Postfach", wide: true },
  { k: "plz", label: "PLZ" },
  { k: "ort", label: "Ort" },
  { k: "region", label: "Bundesstaat / Provinz" },
  { k: "telefon", label: "Telefon (optional)" },
];

async function bildZuDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Bild konnte nicht gelesen werden"));
      i.src = url;
    });
    const max = 1600;
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function LabelPage() {
  const [absender, setAbsender] = useState<LabelAdresse>(LEERE_ADRESSE);
  const [absenderOffen, setAbsenderOffen] = useState(false);
  const [empf, setEmpf] = useState<LabelAdresse>(LEERE_ADRESSE);
  const [vermerk, setVermerk] = useState("");
  const [format, setFormat] = useState<FormatKey>("a6hoch");
  const [lese, setLese] = useState(false);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", SENDER_KEY).maybeSingle();
      if (data?.value) {
        try { setAbsender({ ...LEERE_ADRESSE, ...JSON.parse(data.value) }); return; } catch { /* leer */ }
      }
      setAbsenderOffen(true);
    })();
  }, []);

  const speichereAbsender = async () => {
    const { error } = await supabase.from("settings").upsert(
      [{ key: SENDER_KEY, value: JSON.stringify(absender), updated_at: new Date().toISOString() }],
      { onConflict: "key" },
    );
    if (error) toast.error("Speichern fehlgeschlagen");
    else { toast.success("Absender gespeichert"); setAbsenderOffen(false); }
  };

  const leseBild = async (file: File | undefined | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setLese(true);
    try {
      const image = await bildZuDataUrl(file);
      setVorschau(image);
      const { data, error } = await supabase.functions.invoke("label-address-ocr", { body: { image } });
      if (error || data?.error) throw new Error(data?.error || "Texterkennung fehlgeschlagen");
      setEmpf({ ...LEERE_ADRESSE, ...data.adresse });
      toast.success("Adresse erkannt, bitte kurz prüfen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLese(false);
    }
  };

  // Einfügen mit Strg+V (Screenshot)
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) { e.preventDefault(); void leseBild(f); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);

  const f = FORMATE[format];
  const zeilen = useMemo(() => adressZeilen(empf, findLand(absender.land)?.iso ?? "CH"), [empf, absender.land]);
  const abs = useMemo(() => absenderZeilen(absender), [absender]);
  const gross = zeilen.length > 6 ? 5.2 : 6.2; // mm Schrifthöhe

  const feldGrid = (wert: LabelAdresse, set: (a: LabelAdresse) => void) => (
    <div className="grid grid-cols-2 gap-2">
      {FELDER.map(({ k, label, wide }) => (
        <div key={k} className={wide ? "col-span-2" : ""}>
          <label className="text-xs text-muted-foreground">{label}</label>
          <Input value={wert[k]} onChange={(e) => set({ ...wert, [k]: e.target.value })} />
        </div>
      ))}
      <div className="col-span-2">
        <label className="text-xs text-muted-foreground">Land</label>
        <Input
          list="label-laender"
          value={wert.land}
          onChange={(e) => set({ ...wert, land: e.target.value })}
          placeholder="z. B. Schweiz, Deutschland, USA"
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <style>{`
        @page { size: ${f.w}mm ${f.h}mm; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #label-print, #label-print * { visibility: visible !important; }
          #label-print { position: fixed; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <datalist id="label-laender">
        {LAENDER.map((l) => <option key={l.iso} value={l.de} />)}
      </datalist>

      <h1 className="text-2xl font-semibold mb-1">Versandetikett</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Adresse als Bild hochladen, einfügen (Strg+V) oder tippen. Absender wird einmal gespeichert.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <section className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Empfänger</h2>
              <Button variant="ghost" size="sm" onClick={() => { setEmpf(LEERE_ADRESSE); setVorschau(null); setVermerk(""); }}>
                <Trash2 className="h-4 w-4 mr-1" /> Leeren
              </Button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void leseBild(e.target.files?.[0]); e.target.value = ""; }} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void leseBild(e.dataTransfer.files?.[0]); }}
              className="cursor-pointer rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/40"
            >
              {lese ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adresse wird gelesen …</span>
              ) : vorschau ? (
                <img src={vorschau} alt="Adressbild" className="mx-auto max-h-32 rounded" />
              ) : (
                <span className="inline-flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Bild hochladen, hierher ziehen oder einfügen</span>
              )}
            </div>
            {feldGrid(empf, setEmpf)}
            <div>
              <label className="text-xs text-muted-foreground">Vermerk auf dem Etikett (optional, z. B. Zerbrechlich)</label>
              <Input value={vermerk} onChange={(e) => setVermerk(e.target.value)} />
            </div>
          </section>

          <section className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Absender</h2>
              <Button variant="ghost" size="sm" onClick={() => setAbsenderOffen((o) => !o)}>
                {absenderOffen ? "Schliessen" : "Bearbeiten"}
              </Button>
            </div>
            {absenderOffen ? (
              <>
                {feldGrid(absender, setAbsender)}
                <Button onClick={speichereAbsender}><Save className="h-4 w-4 mr-1" /> Absender speichern</Button>
              </>
            ) : (
              <p className="text-sm whitespace-pre-line text-muted-foreground">{abs.join("\n") || "Noch kein Absender gespeichert"}</p>
            )}
          </section>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatKey)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {Object.entries(FORMATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Button onClick={() => window.print()} disabled={zeilen.length === 0}>
              <Printer className="h-4 w-4 mr-1" /> Drucken
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Im Druckdialog: Papiergrösse passend wählen, Ränder „keine“, Skalierung 100 %.
          </p>

          <div className="overflow-auto rounded-lg bg-muted/40 p-4">
            <div
              id="label-print"
              style={{
                width: `${f.w}mm`, height: `${f.h}mm`, background: "#fff", color: "#000",
                boxSizing: "border-box", padding: "6mm", display: "flex", flexDirection: "column",
                fontFamily: "Arial, Helvetica, sans-serif", border: "1px solid #ccc", overflow: "hidden",
              }}
            >
              <div style={{ fontSize: "2.9mm", lineHeight: 1.25, paddingBottom: "2.5mm", borderBottom: "0.4mm solid #000" }}>
                {abs.map((z, i) => <div key={i} style={{ fontWeight: i === 0 ? 700 : 400 }}>{z}</div>)}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "3mm" }}>
                {zeilen.map((z, i) => (
                  <div key={i} style={{ fontSize: `${gross}mm`, lineHeight: 1.22, fontWeight: i === 0 ? 700 : 500, wordBreak: "break-word" }}>{z}</div>
                ))}
                {empf.telefon && <div style={{ fontSize: "3.2mm", marginTop: "2mm" }}>Tel. {empf.telefon}</div>}
              </div>
              {vermerk && (
                <div style={{ border: "0.5mm solid #000", textAlign: "center", fontWeight: 700, fontSize: "4.5mm", padding: "1mm", textTransform: "uppercase" }}>
                  {vermerk}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
