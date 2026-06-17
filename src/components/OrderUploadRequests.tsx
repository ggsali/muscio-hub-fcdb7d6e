import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link2, Mail, Copy, Check, ExternalLink, Download, Trash2, Plus, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
  customerId?: string | null;
  orderName?: string;
}

interface UploadLink {
  id: string;
  token: string;
  title: string;
  beschreibung: string | null;
  expires_at: string | null;
  aktiv: boolean;
  created_at: string;
  customer_id: string | null;
}

interface UploadFile {
  id: string;
  upload_link_id: string;
  filename: string;
  file_type: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  uploader_name: string | null;
  created_at: string;
}

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function formatBytes(b?: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function OrderUploadRequests({ orderId, customerId, orderName }: Props) {
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    beschreibung: "",
    email: "",
    sendEmail: true,
    expiresInDays: 14,
  });

  const load = useCallback(async () => {
    const { data: l } = await supabase
      .from("upload_links")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    setLinks((l as UploadLink[]) || []);
    const ids = (l || []).map((x: any) => x.id);
    if (ids.length > 0) {
      const { data: f } = await supabase
        .from("upload_link_files")
        .select("*")
        .in("upload_link_id", ids)
        .order("created_at", { ascending: false });
      setFiles((f as UploadFile[]) || []);
    } else {
      setFiles([]);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!customerId) { setCustomerEmail(""); setCustomerName(""); return; }
    supabase.from("customers").select("email, vorname, name").eq("id", customerId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCustomerEmail((data as any).email || "");
          setCustomerName([(data as any).vorname, (data as any).name].filter(Boolean).join(" ").trim());
        }
      });
  }, [customerId]);

  const openCreate = () => {
    setForm({
      title: orderName ? `Dateien für ${orderName}` : "Dateien zum Auftrag hochladen",
      beschreibung: "",
      email: customerEmail,
      sendEmail: !!customerEmail,
      expiresInDays: 14,
    });
    setShowCreate(true);
  };

  const createLink = async () => {
    setCreating(true);
    try {
      const expiresAt = form.expiresInDays > 0
        ? new Date(Date.now() + form.expiresInDays * 86400000).toISOString()
        : null;
      const { data, error } = await supabase.from("upload_links").insert({
        title: form.title || "Dateien zum Auftrag",
        beschreibung: form.beschreibung || null,
        customer_id: customerId || null,
        order_id: orderId,
        expires_at: expiresAt,
        max_files: 50,
      }).select().single();
      if (error || !data) throw error || new Error("Fehler beim Erstellen");

      if (form.sendEmail && form.email) {
        const uploadUrl = `${ORIGIN}/upload/${data.token}`;
        const ablauf = expiresAt ? new Date(expiresAt).toLocaleDateString("de-CH") : "";
        const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "datei-anforderung",
            recipientEmail: form.email,
            idempotencyKey: `order-upload-${data.id}`,
            templateData: {
              name: customerName,
              uploadUrl,
              titel: data.title,
              beschreibung: data.beschreibung || "",
              ablauf,
            },
          },
        });
        if (mailErr) {
          toast.warning(`Link erstellt, aber E-Mail-Fehler: ${mailErr.message}`);
        } else {
          toast.success(`Datei-Anforderung an ${form.email} gesendet`);
        }
      } else {
        toast.success("Upload-Link erstellt");
      }
      setShowCreate(false);
      await load();
    } catch (e: any) {
      toast.error(`Fehler: ${e.message || e}`);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${ORIGIN}/upload/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Link kopiert");
  };

  const resendEmail = async (link: UploadLink) => {
    const email = window.prompt("E-Mail-Adresse für Datei-Anforderung:", customerEmail || "");
    if (!email) return;
    try {
      const uploadUrl = `${ORIGIN}/upload/${link.token}`;
      const ablauf = link.expires_at ? new Date(link.expires_at).toLocaleDateString("de-CH") : "";
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "datei-anforderung",
          recipientEmail: email,
          idempotencyKey: `order-upload-${link.id}-${Date.now()}`,
          templateData: {
            name: customerName,
            uploadUrl,
            titel: link.title,
            beschreibung: link.beschreibung || "",
            ablauf,
          },
        },
      });
      if (error) throw error;
      toast.success(`E-Mail an ${email} gesendet`);
    } catch (e: any) {
      toast.error(`Fehler: ${e.message || e}`);
    }
  };

  const deleteLink = async (id: string) => {
    if (!confirm("Datei-Anforderung und alle zugehörigen Dateieinträge löschen?")) return;
    await supabase.from("upload_links").delete().eq("id", id);
    await load();
    toast.success("Gelöscht");
  };

  const downloadFile = async (f: UploadFile) => {
    const { data } = await supabase.storage.from("project-uploads").createSignedUrl(f.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filesForLink = (id: string) => files.filter(f => f.upload_link_id === id);

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Datei-Anforderungen</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Sende dem Kunden einen Upload-Link für diesen Auftrag</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Neue Anforderung
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">Noch keine Datei-Anforderungen erstellt</p>
      ) : (
        <div className="space-y-2">
          {links.map(link => {
            const lf = filesForLink(link.id);
            return (
              <div key={link.id} className="border border-border rounded-md p-3 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link2 className={`w-3.5 h-3.5 ${link.aktiv ? "text-success" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm truncate">{link.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{lf.length} Datei{lf.length !== 1 ? "en" : ""}</span>
                    </div>
                    {link.expires_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Läuft ab: {new Date(link.expires_at).toLocaleDateString("de-CH")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyLink(link.token)} title="Link kopieren" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                      {copied === link.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => resendEmail(link)} title="E-Mail senden" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => window.open(`/upload/${link.token}`, "_blank")} title="Öffnen" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteLink(link.id)} title="Löschen" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {lf.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                    {lf.map(f => {
                      const isImg = (f.file_type || "").startsWith("image/");
                      return (
                        <button
                          key={f.id}
                          onClick={() => downloadFile(f)}
                          className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-left group"
                        >
                          {isImg ? <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className="flex-1 truncate">{f.filename}</span>
                          {f.uploader_name && <span className="text-muted-foreground text-[10px]">{f.uploader_name}</span>}
                          <span className="text-muted-foreground text-[10px]">{formatBytes(f.file_size_bytes)}</span>
                          <Download className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Datei-Anforderung erstellen</AlertDialogTitle>
            <AlertDialogDescription>
              Erstelle einen Upload-Link für diesen Auftrag und sende ihn optional per E-Mail an den Kunden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={form.beschreibung}
                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={2}
                placeholder="z.B. Bitte lade die finalen STL-Dateien sowie Referenzbilder hoch."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gültig für (Tage)</Label>
                <Input
                  type="number" min={1} max={365}
                  value={form.expiresInDays}
                  onChange={e => setForm(f => ({ ...f, expiresInDays: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kunden-E-Mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="kunde@beispiel.ch"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={form.sendEmail}
                onChange={e => setForm(f => ({ ...f, sendEmail: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>Link direkt per E-Mail senden</span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); createLink(); }}
              disabled={creating || !form.title.trim() || (form.sendEmail && !form.email.trim())}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {form.sendEmail ? "Erstellen & senden" : "Nur erstellen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
