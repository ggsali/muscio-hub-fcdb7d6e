import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CheckCircle2, Circle, Paperclip, AlertTriangle, X, Upload, ExternalLink, Mail, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Bill {
  id: string;
  titel: string;
  betrag: number;
  faellig_am: string | null;
  bezahlt_am: string | null;
  bezahlt: boolean;
  notiz: string | null;
  file_path: string | null;
  filename: string | null;
  created_at: string;
}

interface Props {
  orderId: string;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

export default function BillsSection({ orderId }: Props) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ titel: "", betrag: "", faellig_am: "", notiz: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await (supabase.from as any)("bills")
      .select("*")
      .eq("order_id", orderId)
      .order("faellig_am", { ascending: true, nullsFirst: false });
    if (data) setBills(data as Bill[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  const handleAdd = async () => {
    if (!form.titel.trim()) return;
    setSaving(true);
    await (supabase.from as any)("bills").insert({
      order_id: orderId,
      titel: form.titel.trim(),
      betrag: parseFloat(form.betrag) || 0,
      faellig_am: form.faellig_am || null,
      notiz: form.notiz.trim() || null,
    });
    setForm({ titel: "", betrag: "", faellig_am: "", notiz: "" });
    setAdding(false);
    setSaving(false);
    await load();
    toast({ description: "Rechnung hinzugefügt." });
  };

  const toggleBezahlt = async (bill: Bill) => {
    const bezahlt = !bill.bezahlt;
    await (supabase.from as any)("bills").update({
      bezahlt,
      bezahlt_am: bezahlt ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", bill.id);
    await load();
  };

  const handleDelete = async (id: string, filePath: string | null) => {
    if (filePath) await supabase.storage.from("bills").remove([filePath]);
    await (supabase.from as any)("bills").delete().eq("id", id);
    await load();
  };

  const handleFileUpload = async (billId: string, file: File) => {
    setUploadingFor(billId);
    const ext = file.name.split(".").pop();
    const path = `${orderId}/${billId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("bills").upload(path, file, { upsert: true });
    if (error) {
      toast({ variant: "destructive", description: "Upload fehlgeschlagen." });
    } else {
      await (supabase.from as any)("bills").update({ file_path: path, filename: file.name }).eq("id", billId);
      await load();
      toast({ description: "Datei hochgeladen." });
    }
    setUploadingFor(null);
  };

  const getFileUrl = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("bills").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) {
        toast({ variant: "destructive", description: "PDF konnte nicht geöffnet werden." });
        return;
      }
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = path.split("/").pop() || "dokument.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast({ variant: "destructive", description: "Fehler beim Öffnen des PDFs." });
    }
  };

  const emailBills = bills.filter(b => b.titel?.includes("per E-Mail gesendet"));
  const rechnungBills = bills.filter(b => !b.titel?.includes("per E-Mail gesendet"));
  const unpaidTotal = rechnungBills.filter(b => !b.bezahlt).reduce((s, b) => s + b.betrag, 0);
  const overdueCount = rechnungBills.filter(b => !b.bezahlt && (daysUntil(b.faellig_am) ?? 1) < 0).length;
  const soonCount = rechnungBills.filter(b => !b.bezahlt && (daysUntil(b.faellig_am) ?? 99) >= 0 && (daysUntil(b.faellig_am) ?? 99) <= 7).length;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Rechnungen & Zahlungen</h3>
          {overdueCount > 0 && (
            <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-medium">
              {overdueCount} überfällig
            </span>
          )}
          {soonCount > 0 && overdueCount === 0 && (
            <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full font-medium">
              {soonCount} bald fällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {bills.length > 0 && unpaidTotal > 0 && (
            <span className="text-xs text-muted-foreground">
              Offen: <span className="font-semibold text-foreground">CHF {unpaidTotal.toFixed(2)}</span>
            </span>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-border" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {adding && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Neue Rechnung</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Input
                placeholder="Bezeichnung (z.B. Filament-Bestellung, Maschinen-Service)"
                value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="text-sm h-8"
                autoFocus
              />
            </div>
            <Input
              placeholder="Betrag (CHF)"
              type="number"
              step="0.01"
              value={form.betrag}
              onChange={e => setForm(f => ({ ...f, betrag: e.target.value }))}
              className="text-sm h-8"
            />
            <Input
              type="date"
              value={form.faellig_am}
              onChange={e => setForm(f => ({ ...f, faellig_am: e.target.value }))}
              className="text-sm h-8"
            />
            <div className="col-span-2">
              <Input
                placeholder="Notiz (optional)"
                value={form.notiz}
                onChange={e => setForm(f => ({ ...f, notiz: e.target.value }))}
                className="text-sm h-8"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.titel.trim()} className="text-xs h-7">
              {saving ? "Speichern..." : "Hinzufügen"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="text-xs h-7 border-border">
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Bills List */}
      {!loading && rechnungBills.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-4">Noch keine Rechnungen erfasst.</p>
      )}

      <div className="space-y-2">
        {rechnungBills.map(bill => {
          const days = daysUntil(bill.faellig_am);
          const isOverdue = !bill.bezahlt && days !== null && days < 0;
          const isSoon = !bill.bezahlt && days !== null && days >= 0 && days <= 7;

          return (
            <div
              key={bill.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                bill.bezahlt
                  ? "border-border bg-muted/10 opacity-60"
                  : isOverdue
                  ? "border-destructive/30 bg-destructive/5"
                  : isSoon
                  ? "border-warning/30 bg-warning/5"
                  : "border-border bg-card"
              }`}
            >
              {/* Bezahlt Toggle */}
              <button
                onClick={() => toggleBezahlt(bill)}
                className="shrink-0 transition-colors"
                title={bill.bezahlt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
              >
                {bill.bezahlt
                  ? <CheckCircle2 className="w-4.5 h-4.5 text-success w-5 h-5" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                }
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium truncate ${bill.bezahlt ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {bill.titel}
                  </span>
                  {bill.betrag > 0 && (
                    <span className={`text-xs font-semibold shrink-0 ${bill.bezahlt ? "text-muted-foreground" : "text-foreground"}`}>
                      CHF {bill.betrag.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {bill.faellig_am && (
                    <span className={`text-[11px] flex items-center gap-1 ${
                      bill.bezahlt ? "text-muted-foreground" :
                      isOverdue ? "text-destructive font-medium" :
                      isSoon ? "text-warning font-medium" : "text-muted-foreground"
                    }`}>
                      {isOverdue && <AlertTriangle className="w-3 h-3" />}
                      {bill.bezahlt
                        ? `Bezahlt ${bill.bezahlt_am ? new Date(bill.bezahlt_am).toLocaleDateString("de-CH") : ""}`
                        : isOverdue
                        ? `Überfällig seit ${Math.abs(days!)} Tagen`
                        : days === 0
                        ? "Heute fällig"
                        : `Fällig in ${days} Tagen (${new Date(bill.faellig_am).toLocaleDateString("de-CH")})`
                      }
                    </span>
                  )}
                  {bill.notiz && <span className="text-[11px] text-muted-foreground truncate">· {bill.notiz}</span>}
                </div>
              </div>

              {/* Datei */}
              <div className="flex items-center gap-1 shrink-0">
                {bill.file_path ? (
                  <button
                    onClick={() => getFileUrl(bill.file_path!)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    title="Datei öffnen"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline max-w-[80px] truncate">{bill.filename}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(bill.id, f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => { setUploadingFor(bill.id); fileInputRef.current?.click(); }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Datei anhängen"
                      disabled={uploadingFor === bill.id}
                    >
                      {uploadingFor === bill.id
                        ? <Upload className="w-3.5 h-3.5 animate-pulse" />
                        : <Paperclip className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(bill.id, bill.file_path)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {emailBills.length > 0 && (
        <div className="border-t border-border pt-4 mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-3">Gesendete Dokumente</p>
          <div className="space-y-2">
            {emailBills.map(bill => (
              <div key={bill.id} className="flex items-center gap-3 py-2 px-3 bg-muted/20 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bill.titel.replace(" per E-Mail gesendet", "")}</p>
                  <p className="text-xs text-muted-foreground">{bill.notiz}</p>
                </div>
                {bill.betrag > 0 && (
                  <span className="text-xs font-medium text-foreground flex-shrink-0">
                    CHF {bill.betrag.toFixed(2)}
                  </span>
                )}
                {bill.file_path ? (
                  <button
                    onClick={() => getFileUrl(bill.file_path!)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0 border border-primary/20 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                    title="PDF öffnen"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF anzeigen
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground flex-shrink-0">Kein PDF</span>
                )}
                <button
                  onClick={() => handleDelete(bill.id, bill.file_path)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
