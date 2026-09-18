import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Camera, FolderOpen, Loader2, X, Sparkles, CameraOff } from "lucide-react";
import { scanBeleg } from "@/lib/belegScan.functions";
import { cn } from "@/lib/utils";

export type BelegKategorie =
  | "einnahmen" | "div_aufwaende" | "personalaufwand" | "raumaufwand"
  | "unterhalt" | "versicherungen" | "buero" | "abschreibungen";

export const BELEG_KATEGORIEN: { key: BelegKategorie; label: string }[] = [
  { key: "einnahmen", label: "Einnahmen" },
  { key: "div_aufwaende", label: "Div. Aufwände" },
  { key: "personalaufwand", label: "Personalaufwand" },
  { key: "raumaufwand", label: "Raumaufwand (Miete)" },
  { key: "unterhalt", label: "Unterhalt & Fahrzeug" },
  { key: "versicherungen", label: "Versicherungen" },
  { key: "buero", label: "Büro & Verwaltung" },
  { key: "abschreibungen", label: "Abschreibungen" },
];

const MAX_BYTES = 10 * 1024 * 1024;
const heute = () => new Date().toISOString().slice(0, 10);

interface Props {
  jahr: number;
  kategorie: BelegKategorie;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function BelegScanDialog({ jahr, kategorie, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bildSpeichern, setBildSpeichern] = useState(true);
  const [form, setForm] = useState({ datum: heute(), text: "", beleg: "", betrag: "", kategorie });
  const [dragOver, setDragOver] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // Video-Element wird im selben Render gesetzt
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      console.error("[BelegScan] Kamera", e);
      toast.error("Kamera nicht verfügbar – bitte Berechtigung erlauben oder Datei wählen");
      cameraRef.current?.click();
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { toast.error("Kamera noch nicht bereit"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { toast.error("Foto fehlgeschlagen"); return; }
      const f = new File([blob], `beleg_${Date.now()}.jpg`, { type: "image/jpeg" });
      stopCamera();
      void handleFile(f);
    }, "image/jpeg", 0.92);
  };

  React.useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const toBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
      reader.readAsDataURL(f);
    });

  const handleFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { toast.error("Bild zu gross, max. 10MB"); return; }
    setFile(f);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setShowForm(true);
    setAnalysing(true);
    try {
      const base64 = await toBase64(f);
      const result = await scanBeleg({ data: { fileBase64: base64, mimeType: f.type || "image/jpeg" } });
      setForm(prev => ({
        ...prev,
        datum: result.datum ?? prev.datum,
        text: result.text ?? "",
        beleg: result.beleg_nr ?? "",
        betrag: result.betrag != null ? String(result.betrag) : "",
      }));
      if (!result.datum && !result.betrag && !result.text) {
        toast.error("Erkennung fehlgeschlagen – Felder manuell ausfüllen");
      } else {
        toast.success("Beleg erkannt – bitte prüfen");
      }
    } catch (e) {
      console.error("[BelegScan]", e);
      toast.error("Erkennung fehlgeschlagen – Felder manuell ausfüllen");
    } finally {
      setAnalysing(false);
    }
  };

  const buchen = async () => {
    if (!form.text.trim()) { toast.error("Text ist ein Pflichtfeld"); return; }
    const betrag = Number(form.betrag || 0);
    setSaving(true);
    let storagePath: string | null = null;
    let belegUrl: string | null = null;

    if (bildSpeichern && file) {
      const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
      const path = `${jahr}/${form.kategorie}/${form.datum || heute()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("belege").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) {
        console.error("[BelegScan] upload", upErr);
        toast.error("Beleg-Bild konnte nicht gespeichert werden – Eintrag wird ohne Bild gebucht");
      } else {
        storagePath = path;
        const { data: signed } = await supabase.storage.from("belege").createSignedUrl(path, 60 * 60 * 24 * 365);
        belegUrl = signed?.signedUrl ?? null;
      }
    }

    const { error } = await supabase.from("ear_buchungen").insert({
      jahr,
      kategorie: form.kategorie,
      datum: form.datum || null,
      text: form.text.trim(),
      beleg: form.beleg.trim() || null,
      einnahmen: form.kategorie === "einnahmen" ? betrag : 0,
      ausgaben: form.kategorie === "einnahmen" ? 0 : betrag,
      beleg_storage_path: storagePath,
      beleg_url: belegUrl,
    });
    setSaving(false);
    if (error) { toast.error("Buchung fehlgeschlagen"); return; }
    toast.success("✓ Beleg erfolgreich gebucht");
    await onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-stretch sm:items-center justify-center sm:p-4 overflow-y-auto">
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl shadow-xl flex flex-col max-h-screen sm:max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Beleg scannen</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!showForm ? (
            <>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => void handleFile(e.target.files?.[0])} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => void handleFile(e.target.files?.[0])} />
              {cameraOn ? (
                <div className="space-y-3">
                  <video ref={videoRef} playsInline muted autoPlay
                    className="w-full rounded-xl border border-border bg-black aspect-[3/4] object-cover" />
                  <Button className="w-full min-h-[52px] text-base" onClick={capturePhoto}>
                    <Camera className="w-5 h-5 mr-2" /> Foto aufnehmen
                  </Button>
                  <Button variant="outline" className="w-full min-h-[44px]" onClick={stopCamera}>
                    <CameraOff className="w-4 h-4 mr-2" /> Kamera schliessen
                  </Button>
                </div>
              ) : (
                <>
                  <Button className="w-full min-h-[52px] text-base" onClick={() => void startCamera()}>
                    <Camera className="w-5 h-5 mr-2" /> Kamera öffnen &amp; scannen
                  </Button>
                  <Button variant="outline" className="w-full min-h-[48px]" onClick={() => cameraRef.current?.click()}>
                    <Camera className="w-5 h-5 mr-2" /> Foto-App öffnen
                  </Button>
                  <Button variant="outline" className="w-full min-h-[48px]" onClick={() => fileRef.current?.click()}>
                    <FolderOpen className="w-5 h-5 mr-2" /> Datei wählen
                  </Button>
                </>
              )}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
                className={cn(
                  "border-2 border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                Bild hierher ziehen
              </div>
              <p className="text-xs text-muted-foreground text-center">Maximal 10MB · JPG, PNG oder PDF</p>
            </>
          ) : (
            <>
              {previewUrl && (
                <img src={previewUrl} alt="Beleg-Vorschau" className="w-full max-h-52 object-contain rounded-xl border border-border bg-muted" />
              )}
              {!previewUrl && file && (
                <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">{file.name}</div>
              )}

              {analysing ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Beleg wird analysiert…
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Datum</label>
                      <Input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Betrag CHF</label>
                      <Input type="number" step="0.05" value={form.betrag} onChange={e => setForm({ ...form, betrag: e.target.value })} className="text-right tabular-nums" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Text *</label>
                    <Input value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="Lieferant + Zweck" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Beleg-Nr.</label>
                    <Input value={form.beleg} onChange={e => setForm({ ...form, beleg: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kategorie</label>
                    <select
                      value={form.kategorie}
                      onChange={e => setForm({ ...form, kategorie: e.target.value as BelegKategorie })}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {BELEG_KATEGORIEN.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Beleg-Bild speichern</p>
                      <p className="text-xs text-muted-foreground">Wird im Archiv abgelegt</p>
                    </div>
                    <Switch checked={bildSpeichern} onCheckedChange={setBildSpeichern} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showForm && (
          <div className="flex gap-2 px-4 py-3 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Abbrechen</Button>
            <Button className="flex-1" onClick={() => void buchen()} disabled={analysing || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Buchen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
