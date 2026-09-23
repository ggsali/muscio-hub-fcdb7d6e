import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { scanSlicer, type SlicerScanResult } from "@/lib/slicerScan.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (druckzeit_h: number, gewicht_g: number) => void;
}

async function compressToBase64(file: Blob): Promise<{ base64: string; url: string }> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1] ?? "", url: dataUrl };
}

export default function SlicerScanModal({ open, onClose, onApply }: Props) {
  const scan = useServerFn(scanSlicer);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<SlicerScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const handle = async (file: Blob) => {
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild wählen.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { base64, url } = await compressToBase64(file);
      setPreview(url);
      setResult(await scan({ data: { image_base64: base64 } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler bei der Analyse");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setResult(null);
      setError(null);
      return;
    }
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void handle(f);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = result && result.druckzeit_h !== null && result.gewicht_g !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Slicer-Screenshot scannen</DialogTitle>
        </DialogHeader>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void handle(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 min-h-40 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${over ? "border-primary bg-primary/10" : "border-primary/40 hover:bg-primary/5"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handle(f);
              e.target.value = "";
            }}
          />
          {preview ? (
            <img src={preview} alt="Screenshot" className="max-h-48 rounded" />
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground">Bild wählen, hierher ziehen oder mit Strg/⌘+V einfügen</p>
            </>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Screenshot wird analysiert…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && !loading && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Druckzeit (h)</div>
              <div className="font-semibold">{result.druckzeit_h ?? "–"}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Gewicht (g)</div>
              <div className="font-semibold">{result.gewicht_g ?? "–"}</div>
            </div>
            {!valid && <p className="col-span-2 text-xs text-destructive">Nicht alle Werte erkannt.</p>}
          </div>
        )}

        <Button
          disabled={!valid || loading}
          onClick={() => {
            if (!result || result.druckzeit_h === null || result.gewicht_g === null) return;
            onApply(result.druckzeit_h, result.gewicht_g);
            onClose();
          }}
        >
          Werte übernehmen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
