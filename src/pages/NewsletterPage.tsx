import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Sparkles, Eye, Send, ImagePlus, BookOpen, Loader2, Users } from "lucide-react";

type Customer = { id: string; name: string | null; vorname: string | null; email: string | null };
type Newsletter = {
  id: string; betreff: string; inhalt_text: string; bild_url: string | null;
  blog_link_url: string | null; blog_link_titel: string | null; status: string;
  empfaenger_anzahl: number; erstellt_am: string; gesendet_am: string | null;
};
type BlogPost = { id: string; titel: string; slug: string; veroeffentlicht_am: string | null };
type Recipient = { email: string; name: string; customer_id: string };

const SITE_URL = "https://3dmuscio.com";

function customerName(c: Customer) {
  return [c.vorname, c.name].filter(Boolean).join(" ").trim() || c.email || "Kunde";
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
}

/** Live-Vorschau des Newsletters (vereinfachtes Abbild des E-Mail-Templates). */
function NewsletterPreview({
  betreff, inhalt, bildUrl, blogUrl, blogTitel,
}: { betreff: string; inhalt: string; bildUrl: string; blogUrl: string; blogTitel: string }) {
  const text = inhalt.replace(/\[Kundenname\]/g, "Herr Muster").replace(/\[LINK_KALKULATOR\]/g, "");
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="rounded-xl overflow-hidden bg-white text-zinc-800">
      <div className="px-6 py-5 bg-[#0f172a] flex items-center gap-3">
        <img
          src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
          alt="3DMuscio" className="w-10 h-10 rounded-lg object-cover"
        />
        <div className="leading-tight">
          <div className="text-white font-bold text-[17px]">3DMuscio</div>
          <div className="text-[12px] text-zinc-400">3D-Druck Schweiz</div>
        </div>
      </div>
      {bildUrl && <img src={bildUrl} alt="" className="w-full object-cover max-h-64" loading="lazy" />}
      <div className="px-6 pt-6 pb-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-3">Betreff: {betreff || "–"}</p>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">{p}</p>
        ))}
      </div>
      <div className="px-6 pb-6 text-center">
        <span className="inline-block bg-[#16a34a] text-white px-7 py-3.5 rounded-lg text-[15px] font-semibold">
          Jetzt Preis berechnen →
        </span>
      </div>
      {blogUrl && (
        <div className="px-6 pb-6">
          <div className="bg-zinc-100 rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Lesenswerter Beitrag</p>
            <span className="text-[15px] font-semibold text-[#16a34a]">📖 {blogTitel || "Zum Beitrag"} →</span>
          </div>
        </div>
      )}
      <div className="px-6 py-5 border-t border-zinc-200 text-[12px] text-zinc-500">
        <p className="mb-2">3DMuscio | Gartensiedlung 13, 8360 Eschlikon TG | info@3dmuscio.com | www.3dmuscio.com</p>
        <p className="underline text-zinc-400">Vom Newsletter abmelden</p>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  const [tab, setTab] = useState("neu");

  // Editor
  const [thema, setThema] = useState("");
  const [kiLoading, setKiLoading] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [bildUrl, setBildUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [blogUrl, setBlogUrl] = useState("");
  const [blogTitel, setBlogTitel] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blogModalOpen, setBlogModalOpen] = useState(false);

  // Empfänger
  const [mode, setMode] = useState<"alle" | "mit_auftrag" | "manuell">("alle");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [withOrders, setWithOrders] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Versand
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  // Verlauf
  const [history, setHistory] = useState<Newsletter[]>([]);
  const [detail, setDetail] = useState<Newsletter | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<{ email: string; name: string | null; gesendet: boolean }[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: os }] = await Promise.all([
        supabase.from("customers").select("id,name,vorname,email").eq("newsletter_aktiv", true).not("email", "is", null),
        supabase.from("orders").select("customer_id"),
      ]);
      setCustomers((cs ?? []).filter((c) => !!c.email) as Customer[]);
      setWithOrders(new Set((os ?? []).map((o) => o.customer_id).filter(Boolean) as string[]));
    })();
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data } = await supabase.from("newsletters").select("*").order("erstellt_am", { ascending: false });
    setHistory((data ?? []) as Newsletter[]);
  }

  async function openBlogModal() {
    setBlogModalOpen(true);
    const { data } = await supabase
      .from("blog_posts").select("id,titel,slug,veroeffentlicht_am")
      .eq("veroeffentlicht", true).order("veroeffentlicht_am", { ascending: false });
    setBlogPosts((data ?? []) as BlogPost[]);
  }

  const recipients: Recipient[] = useMemo(() => {
    const base = mode === "mit_auftrag"
      ? customers.filter((c) => withOrders.has(c.id))
      : mode === "manuell"
        ? customers.filter((c) => selected.has(c.id))
        : customers;
    return base.map((c) => ({ email: c.email!, name: customerName(c), customer_id: c.id }));
  }, [mode, customers, withOrders, selected]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => customerName(c).toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
  }, [customers, search]);

  async function generateDraft() {
    if (!thema.trim()) { toast.error("Bitte ein Thema angeben"); return; }
    setKiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-newsletter", { body: { thema } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBetreff((data as any).betreff ?? "");
      setInhalt((data as any).inhalt ?? "");
      toast.success("KI-Entwurf erstellt");
    } catch (e: any) {
      toast.error(e?.message ?? "KI-Entwurf fehlgeschlagen");
    } finally {
      setKiLoading(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `newsletter/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("projekte").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("projekte").getPublicUrl(path);
      setBildUrl(data.publicUrl);
      toast.success("Bild hochgeladen");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    setSending(true);
    setProgress(15);
    try {
      const { data: nl, error: insErr } = await supabase.from("newsletters").insert({
        betreff: betreff.trim(),
        inhalt_text: inhalt,
        bild_url: bildUrl || null,
        blog_link_url: blogUrl || null,
        blog_link_titel: blogTitel || null,
        status: "entwurf",
      }).select("id").single();
      if (insErr) throw insErr;

      setProgress(40);
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { newsletter_id: nl.id, empfaenger: recipients },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setProgress(100);
      toast.success(`Newsletter erfolgreich an ${(data as any).sent} Empfänger gesendet ✓`);
      setThema(""); setBetreff(""); setInhalt(""); setBildUrl(""); setBlogUrl(""); setBlogTitel("");
      await loadHistory();
      setTab("verlauf");
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally {
      setSending(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  async function openDetail(nl: Newsletter) {
    setDetail(nl);
    const { data } = await supabase
      .from("newsletter_empfaenger").select("email,name,gesendet")
      .eq("newsletter_id", nl.id).order("email");
    setDetailRecipients((data ?? []) as any);
  }

  const canSend = betreff.trim().length > 0 && inhalt.trim().length > 0 && recipients.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Newsletter</h1>
          <p className="text-sm text-muted-foreground">Kunden-Newsletter erstellen und versenden</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="neu">Neuer Newsletter</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="neu" className="space-y-6">
          {/* KI-Assistent */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> KI-Assistent
            </h2>
            <Label htmlFor="thema" className="text-sm">Worum geht es in diesem Newsletter?</Label>
            <Textarea
              id="thema" value={thema} onChange={(e) => setThema(e.target.value)} rows={3} className="mt-2"
              placeholder="z.B. Neue Materialien, Saisonangebot, Tipp zur Dateivorbereitung..."
            />
            <Button onClick={generateDraft} disabled={kiLoading} className="mt-3">
              {kiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              KI-Entwurf erstellen
            </Button>
          </section>

          {/* Editor */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Inhalt</h2>
            <div>
              <Label htmlFor="betreff" className="text-sm">Betreff *</Label>
              <Input id="betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} className="mt-2" placeholder="Betreff des Newsletters" />
            </div>
            <div>
              <Label htmlFor="inhalt" className="text-sm">Inhalt *</Label>
              <Textarea id="inhalt" value={inhalt} onChange={(e) => setInhalt(e.target.value)} rows={14} className="mt-2 font-mono text-[13px]" placeholder="Guten Tag [Kundenname], ..." />
              <p className="text-xs text-muted-foreground mt-1">
                Platzhalter: <code>[Kundenname]</code> wird pro Empfänger ersetzt. <code>[LINK_KALKULATOR]</code> wird durch den CTA-Button ersetzt.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <Label htmlFor="bild" className="text-sm">Bild (optional) – URL</Label>
                <Input id="bild" value={bildUrl} onChange={(e) => setBildUrl(e.target.value)} className="mt-2" placeholder="https://..." />
              </div>
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ""; }} />
                <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm cursor-pointer hover:bg-muted">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Hochladen
                </span>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="blogurl" className="text-sm">Blog-Link – URL (optional)</Label>
                <Input id="blogurl" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} className="mt-2" placeholder="https://3dmuscio.com/blog/..." />
              </div>
              <div>
                <Label htmlFor="blogtitel" className="text-sm">Blog-Link – Text</Label>
                <Input id="blogtitel" value={blogTitel} onChange={(e) => setBlogTitel(e.target.value)} className="mt-2" placeholder="FDM vs SLA – Welches Material passt?" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openBlogModal}>
              <BookOpen className="w-4 h-4 mr-2" /> Aus Blog wählen
            </Button>

            <div>
              <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4 mr-2" /> Vorschau
              </Button>
            </div>
          </section>

          {/* Empfänger */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Empfänger
            </h2>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="alle" id="m-alle" />
                <Label htmlFor="m-alle" className="text-sm font-normal">Alle aktiven Kunden</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mit_auftrag" id="m-auftrag" />
                <Label htmlFor="m-auftrag" className="text-sm font-normal">Kunden mit Aufträgen</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manuell" id="m-manuell" />
                <Label htmlFor="m-manuell" className="text-sm font-normal">Manuelle Auswahl</Label>
              </div>
            </RadioGroup>

            {mode === "manuell" && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-3 border-b border-border">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nach Name oder E-Mail suchen..." />
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {filteredCustomers.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            v ? next.add(c.id) : next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate">{customerName(c)}</span>
                      <span className="text-muted-foreground truncate">{c.email}</span>
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">Keine Kunden gefunden</p>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm font-medium text-foreground">{recipients.length} Empfänger ausgewählt</p>
            {recipients.length < 1 && (
              <p className="text-sm text-destructive">Keine Empfänger ausgewählt</p>
            )}
          </section>

          {sending && <Progress value={progress} className="h-2" />}

          <Button size="lg" disabled={!canSend || sending} onClick={() => setConfirmOpen(true)} className="w-full md:w-auto">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Newsletter an {recipients.length} Empfänger senden
          </Button>
        </TabsContent>

        <TabsContent value="verlauf">
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {history.map((nl) => (
              <button key={nl.id} onClick={() => openDetail(nl)} className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{nl.betreff}</p>
                  <p className="text-xs text-muted-foreground">
                    {nl.status === "gesendet" ? `Gesendet am ${fmt(nl.gesendet_am)}` : `Erstellt am ${fmt(nl.erstellt_am)}`} · {nl.empfaenger_anzahl} Empfänger
                  </p>
                </div>
                <Badge variant={nl.status === "gesendet" ? "default" : "secondary"}>
                  {nl.status === "gesendet" ? "Gesendet" : "Entwurf"}
                </Badge>
              </button>
            ))}
            {history.length === 0 && (
              <p className="px-4 py-10 text-sm text-muted-foreground text-center">Noch keine Newsletter vorhanden</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Vorschau */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vorschau</DialogTitle></DialogHeader>
          <NewsletterPreview betreff={betreff} inhalt={inhalt} bildUrl={bildUrl} blogUrl={blogUrl} blogTitel={blogTitel} />
        </DialogContent>
      </Dialog>

      {/* Blog-Auswahl */}
      <Dialog open={blogModalOpen} onOpenChange={setBlogModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Blog-Beitrag wählen</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {blogPosts.map((p) => (
              <button key={p.id}
                onClick={() => {
                  setBlogUrl(`${SITE_URL}/blog/${p.slug}`);
                  setBlogTitel(p.titel);
                  setBlogModalOpen(false);
                }}
                className="w-full text-left px-2 py-3 hover:bg-muted/50">
                <p className="text-sm font-medium text-foreground">{p.titel}</p>
                <p className="text-xs text-muted-foreground">{fmt(p.veroeffentlicht_am)}</p>
              </button>
            ))}
            {blogPosts.length === 0 && (
              <p className="px-2 py-8 text-sm text-muted-foreground text-center">Keine veröffentlichten Beiträge</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailansicht */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.betreff}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <NewsletterPreview
                betreff={detail.betreff} inhalt={detail.inhalt_text}
                bildUrl={detail.bild_url ?? ""} blogUrl={detail.blog_link_url ?? ""} blogTitel={detail.blog_link_titel ?? ""}
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Empfänger ({detailRecipients.length})</h3>
                <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border">
                  {detailRecipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{r.name || "–"}</span>
                      <span className="text-muted-foreground truncate">{r.email}</span>
                      <Badge variant={r.gesendet ? "default" : "destructive"}>{r.gesendet ? "OK" : "Fehler"}</Badge>
                    </div>
                  ))}
                  {detailRecipients.length === 0 && (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">Keine Empfänger erfasst</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bestätigung */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Newsletter jetzt senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Newsletter «{betreff}» wird an {recipients.length} Empfänger gesendet. Dies kann nicht widerrufen werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Senden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
