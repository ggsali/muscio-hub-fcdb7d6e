import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Printer, Save } from "lucide-react";
import { code128Svg } from "@/lib/code128";
import { STEMPEL_KEY } from "@/lib/arbeitszeit";

const FORMATE = [
  { id: "62x29", label: "62 × 29 mm (Brother DK-11209)", w: 62, h: 29 },
  { id: "62x100", label: "62 × 100 mm (Brother DK-11202)", w: 62, h: 100 },
  { id: "29x90", label: "29 × 90 mm (Brother DK-11201 Adresse)", w: 29, h: 90 },
  { id: "38x90", label: "38 × 90 mm (Brother DK-11208 gross)", w: 38, h: 90 },
  { id: "50x30", label: "50 × 30 mm (Niimbot / Thermo-Etikett)", w: 50, h: 30 },
];
const NAME_KEY = "stempel_name";
const FORMAT_KEY = "stempel_label_format";

interface Props {
  code: string | null;
  onGespeichert: (code: string) => void;
}

export default function StempelLabel({ code, onGespeichert }: Props) {
  const [eingabe, setEingabe] = useState(code ?? "MUSCIO-STEMPEL");
  const [name, setName] = useState("");
  const [format, setFormat] = useState("62x29");

  useEffect(() => { if (code) setEingabe(code); }, [code]);
  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", [NAME_KEY, FORMAT_KEY]).then(({ data }) => {
      for (const r of (data ?? []) as { key: string; value: string }[]) {
        if (r.key === NAME_KEY) setName(r.value);
        if (r.key === FORMAT_KEY && FORMATE.some((f) => f.id === r.value)) setFormat(r.value);
      }
    });
  }, []);

  const fmt = FORMATE.find((f) => f.id === format) ?? FORMATE[0];
  const fehler = useMemo(() => {
    try { code128Svg(eingabe); return null; } catch (e: any) { return e.message as string; }
  }, [eingabe]);
  const svg = useMemo(() => (fehler || !eingabe ? "" : code128Svg(eingabe, 2, 80)), [eingabe, fehler]);

  const speichern = async () => {
    const wert = eingabe.trim();
    if (!wert || fehler) return;
    const { error } = await supabase.from("settings").upsert(
      [{ key: STEMPEL_KEY, value: wert }, { key: NAME_KEY, value: name.trim() }, { key: FORMAT_KEY, value: format }],
      { onConflict: "key" },
    );
    if (error) { toast.error(error.message); return; }
    onGespeichert(wert);
    toast.success("Stempel-Code gespeichert. Alte Barcodes mit dem früheren Code gelten nicht mehr.");
  };

  const drucken = () => {
    if (fehler || !eingabe) return;
    const rand = fmt.h <= 32 ? 1.5 : 3;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stempel-Label</title><style>
      @page { size: ${fmt.w}mm ${fmt.h}mm; margin: 0 }
      * { box-sizing: border-box }
      html, body { margin: 0; padding: 0; width: ${fmt.w}mm; height: ${fmt.h}mm; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff }
      .l { width: ${fmt.w}mm; height: ${fmt.h}mm; padding: ${rand}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; overflow: hidden }
      .n { font-size: ${fmt.h <= 32 ? 9 : 13}pt; font-weight: 700; line-height: 1.1; text-align: center }
      .b { width: 100%; flex: 1 1 auto; min-height: 0; display: flex }
      .b svg { width: 100%; height: 100% }
      .c { font-size: ${fmt.h <= 32 ? 6.5 : 8}pt; font-family: monospace; letter-spacing: .5px }
    </style></head><body><div class="l">${name.trim() ? `<div class="n">${name.trim().replace(/</g, "&lt;")}</div>` : ""}<div class="b">${svg}</div><div class="c">${eingabe.replace(/</g, "&lt;")}</div></div></body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 60000);
    }, 250);
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Stempel-Barcode erstellen und drucken</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Hier legst du den Code fest, den der Scanner zum Ein- und Ausstempeln erkennt, und druckst ihn auf dein Label.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Name auf dem Label (wer)</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Jorim, Zeit stempeln" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Code (nur Buchstaben, Zahlen, einfache Zeichen)</div>
          <Input value={eingabe} onChange={(e) => setEingabe(e.target.value)} className="font-mono" />
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Label-Grösse</div>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
            {FORMATE.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {fehler ? (
        <div className="text-sm text-destructive">{fehler}</div>
      ) : (
        <div className="flex justify-center">
          <div className="bg-white text-black rounded-md border p-3 flex flex-col items-center gap-1" style={{ width: `${fmt.w * 4}px`, maxWidth: "100%", aspectRatio: `${fmt.w} / ${fmt.h}` }}>
            {name.trim() && <div className="text-sm font-bold text-center leading-tight">{name.trim()}</div>}
            <div className="w-full flex-1 min-h-0 flex [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="text-[10px] font-mono">{eingabe}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={speichern} disabled={!eingabe.trim() || !!fehler}><Save className="h-4 w-4 mr-1" /> Als Stempel-Code speichern</Button>
        <Button variant="outline" onClick={drucken} disabled={!eingabe.trim() || !!fehler}><Printer className="h-4 w-4 mr-1" /> Label drucken</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Beim Drucken den Labeldrucker wählen und Ränder auf «Keine» stellen, Grösse wie das eingelegte Label. Danach den gedruckten Barcode einmal scannen und prüfen, ob eingestempelt wird.
      </p>
    </div>
  );
}
