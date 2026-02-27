import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Copy, Check, ExternalLink, Trash2, Link2, FileText,
  Image, Box, Download, RefreshCw, Calendar, User, Wifi, WifiOff, Upload
} from "lucide-react";
import { toast } from "sonner";

const NAS_URL_KEY = "nas_webdav_url";
const NAS_USER_KEY = "nas_webdav_user";
const NAS_PASS_KEY = "nas_webdav_pass";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const PREVIEW_ORIGIN = window.location.origin;

interface UploadLink {
  id: string;
  token: string;
  title: string;
  beschreibung: string | null;
  expires_at: string | null;
  max_files: number;
  aktiv: boolean;
  created_at: string;
  customer_id: string | null;
}

interface UploadFile {
  id: string;
  filename: string;
  file_type: string | null;
  file_size_bytes: number | null;
  nas_synced: boolean;
  nas_path: string | null;
  storage_path: string;
  uploader_name: string | null;
  uploader_email: string | null;
  created_at: string;
  upload_link_id: string;
}

interface Customer { id: string; name: string; vorname: string | null; firma: string | null; }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fileIcon(type: string | null) {
  if (type?.startsWith("image")) return <Image className="w-4 h-4 text-primary" />;
  if (type?.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  return <Box className="w-4 h-4 text-muted-foreground" />;
}

export default function UploadLinksPage() {
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "Projektdaten hochladen",
    beschreibung: "",
    customer_id: "",
    expires_at: "",
    max_files: 50,
  });

  const load = useCallback(async () => {
    const [{ data: l }, { data: f }, { data: c }] = await Promise.all([
      supabase.from("upload_links").select("*").order("created_at", { ascending: false }),
      supabase.from("upload_link_files").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, vorname, firma").order("name"),
    ]);
    if (l) setLinks(l as UploadLink[]);
    if (f) setFiles(f as UploadFile[]);
    if (c) setCustomers(c as Customer[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createLink = async () => {
    const { data } = await supabase.from("upload_links").insert({
      title: form.title,
      beschreibung: form.beschreibung || null,
      customer_id: form.customer_id || null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      max_files: form.max_files,
    }).select().single();
    if (data) {
      setShowCreate(false);
      setForm({ title: "Projektdaten hochladen", beschreibung: "", customer_id: "", expires_at: "", max_files: 50 });
      await load();
      toast.success("Upload-Link erstellt");
    }
  };

  const toggleLink = async (id: string, aktiv: boolean) => {
    await supabase.from("upload_links").update({ aktiv: !aktiv }).eq("id", id);
    await load();
  };

  const deleteLink = async (id: string) => {
    if (!confirm("Link und alle zugehörigen Dateieinträge löschen?")) return;
    await supabase.from("upload_links").delete().eq("id", id);
    await load();
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${PREVIEW_ORIGIN}/upload/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success("Link kopiert");
  };

  const downloadFile = async (f: UploadFile) => {
    const { data } = await supabase.storage.from("project-uploads").createSignedUrl(f.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filesForLink = (linkId: string) => files.filter(f => f.upload_link_id === linkId);
  const selectedFiles = selectedLink ? filesForLink(selectedLink) : files;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projekt-Uploads</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Upload-Links für Kunden generieren – Dateien landen direkt auf deinem NAS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} className="gap-2 border-border">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />Neuer Upload-Link
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">Aktive Links</div>
          <div className="text-2xl font-bold">{links.filter(l => l.aktiv).length}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">Eingegangene Dateien</div>
          <div className="text-2xl font-bold">{files.length}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-muted-foreground">NAS synchronisiert</div>
          <div className="text-2xl font-bold text-success">{files.filter(f => f.nas_synced).length}</div>
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Links sidebar */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upload-Links</h2>
          <button
            onClick={() => setSelectedLink(null)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
              selectedLink === null ? "bg-primary/10 border-primary/30 text-primary" : "border-transparent hover:bg-muted/50"
            }`}
          >
            Alle Dateien ({files.length})
          </button>
          {links.map(link => (
            <div
              key={link.id}
              className={`rounded-lg border transition-colors ${
                selectedLink === link.id ? "bg-primary/10 border-primary/30" : "border-border bg-card hover:border-border/80"
              }`}
            >
              <button
                className="w-full text-left px-3 py-2.5"
                onClick={() => setSelectedLink(link.id === selectedLink ? null : link.id)}
              >
                <div className="flex items-center gap-2">
                  <Link2 className={`w-3.5 h-3.5 flex-shrink-0 ${link.aktiv ? "text-success" : "text-muted-foreground"}`} />
                  <span className="font-medium text-sm truncate flex-1">{link.title}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{filesForLink(link.id).length}</span>
                </div>
                {link.expires_at && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Läuft ab: {new Date(link.expires_at).toLocaleDateString("de-CH")}
                  </p>
                )}
              </button>
              <div className="flex items-center gap-1 px-3 pb-2">
                <button
                  onClick={() => copyLink(link.token)}
                  className="text-xs flex items-center gap-1 text-primary hover:underline"
                >
                  {copiedToken === link.token ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Link kopieren
                </button>
                <span className="text-muted-foreground mx-1">·</span>
                <button
                  onClick={() => window.open(`/upload/${link.token}`, "_blank")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
                <span className="text-muted-foreground mx-1">·</span>
                <button
                  onClick={() => toggleLink(link.id, link.aktiv)}
                  className={`text-xs ${link.aktiv ? "text-muted-foreground hover:text-destructive" : "text-success hover:text-success/80"}`}
                >
                  {link.aktiv ? "Deaktivieren" : "Aktivieren"}
                </button>
                <span className="text-muted-foreground mx-1">·</span>
                <button onClick={() => deleteLink(link.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Files table */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Eingegangene Dateien {selectedLink ? `(${selectedFiles.length})` : ""}
          </h2>
          {selectedFiles.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm">
              Noch keine Dateien eingegangen.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Datei", "Von", "Grösse", "NAS", "Datum", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-muted-foreground font-medium text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedFiles.map(f => (
                    <tr key={f.id} className="table-row-alt border-b border-border/50 last:border-0 group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fileIcon(f.file_type)}
                          <span className="font-medium truncate max-w-[200px]">{f.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {f.uploader_name ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {f.uploader_name}
                          </div>
                        ) : "—"}
                        {f.uploader_email && <div className="text-xs opacity-70">{f.uploader_email}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {f.file_size_bytes ? formatBytes(f.file_size_bytes) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {f.nas_synced ? (
                          <span className="text-xs text-success font-medium">✓ Synced</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(f.created_at).toLocaleDateString("de-CH")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => downloadFile(f)}
                          className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Upload-Link erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} rows={2} className="bg-input border-border" placeholder="Was soll der Kunde hochladen?" />
            </div>
            <div className="space-y-1.5">
              <Label>Kunde <span className="text-muted-foreground">(optional)</span></Label>
              <select
                value={form.customer_id}
                onChange={e => setForm({ ...form, customer_id: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-sm"
              >
                <option value="">— Keinem Kunden zuordnen —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {[c.vorname, c.name].filter(Boolean).join(" ")}{c.firma ? ` (${c.firma})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ablaufdatum <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Max. Dateien</Label>
                <Input type="number" value={form.max_files} onChange={e => setForm({ ...form, max_files: parseInt(e.target.value) || 50 })} className="bg-input border-border" />
              </div>
            </div>
            <Button onClick={createLink} className="w-full">Link erstellen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
