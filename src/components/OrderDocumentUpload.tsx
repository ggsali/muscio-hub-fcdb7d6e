import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Loader2, FileText, Download, Trash2 } from "lucide-react";

type Doc = { id: string; titel: string | null; file_path: string | null; filename: string | null; created_at: string };

const TYPEN = ["Rechnung", "Offerte", "Auftragsbestätigung", "Lieferschein", "Sonstiges"];

export default function OrderDocumentUpload({ orderId }: { orderId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [typ, setTyp] = useState("Rechnung");
  const [titel, setTitel] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await (supabase.from as any)("bills")
      .select("id, titel, file_path, filename, created_at")
      .eq("order_id", orderId)
      .not("file_path", "is", null)
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) || []);
  };
  useEffect(() => { load(); }, [orderId]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orderId}/uploads/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("bills").upload(path, file, { upsert: false });
      if (error) { toast.error(`Upload fehlgeschlagen: ${file.name}`); continue; }
      await (supabase.from as any)("bills").insert({
        order_id: orderId,
        titel: titel.trim() ? `${typ}: ${titel.trim()}` : typ,
        betrag: 0,
        bezahlt: true,
        file_path: path,
        filename: file.name,
      });
    }
    setTitel("");
    setBusy(false);
    await load();
    toast.success("Dokument hochgeladen");
  };

  const open = async (path: string) => {
    const { data } = await supabase.storage.from("bills").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else toast.error("Dokument konnte nicht geöffnet werden.");
  };

  const remove = async (d: Doc) => {
    if (!confirm(`„${d.filename}" löschen?`)) return;
    if (d.file_path) await supabase.storage.from("bills").remove([d.file_path]);
    await (supabase.from as any)("bills").delete().eq("id", d.id);
    await load();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
      <h3 className="font-semibold text-sm">Dokumente hochladen</h3>
      <div className="flex flex-wrap gap-2">
        <select value={typ} onChange={(e) => setTyp(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          {TYPEN.map((t) => <option key={t}>{t}</option>)}
        </select>
        <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Bezeichnung (optional)" className="h-9 flex-1 min-w-[10rem]" />
        <input ref={inputRef} type="file" multiple className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <Button size="sm" className="h-9 gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Datei wählen
        </Button>
      </div>
      {docs.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.titel || "Dokument"}</div>
                <div className="truncate text-xs text-muted-foreground">{d.filename} · {new Date(d.created_at).toLocaleDateString("de-CH")}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => d.file_path && open(d.file_path)}><Download className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(d)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
