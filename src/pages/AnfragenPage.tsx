import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Phone, Clock, User, RefreshCw, ExternalLink, Plus, ChevronRight, X, ArrowLeft, Download, Paperclip, Loader2, Trash2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import InquiryChat from "@/components/InquiryChat";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Attachment = {
  filename: string;
  storage_path: string;
  bucket?: string;
  size_bytes?: number | null;
};

type Inquiry = {
  id: string;
  name: string;
  email: string;
  telefon: string | null;
  betreff: string | null;
  nachricht: string;
  status: string;
  quelle: string | null;
  customer_id: string | null;
  order_id: string | null;
  notiz: string | null;
  created_at: string;
  herkunft?: string | null;
  attachments?: Attachment[] | null;
  ki_beratung_zusammenfassung?: string | null;
  ki_empfohlenes_material?: string | null;
};


const formatBytes = (n?: number | null) => {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

async function downloadAttachment(att: Attachment) {
  const bucket = att.bucket || "project-uploads";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(att.storage_path, 60 * 10);
  if (error || !data?.signedUrl) {
    console.error(error);
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = att.filename;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const STATUS_COLORS: Record<string, string> = {
  Neu: "bg-primary/15 text-primary border-primary/20",
  "In Bearbeitung": "bg-warning/15 text-warning border-warning/20",
  Erledigt: "bg-success/15 text-success border-success/20",
  Geschlossen: "bg-muted text-muted-foreground border-border",
};

const STATUSES = ["Neu", "In Bearbeitung", "Erledigt", "Geschlossen"] as const;

function InquiryDetail({
  selected, notiz, setNotiz, saving,
  onSaveNotiz, onUpdateStatus, onCreateOrder, onClose, navigate, onDelete
}: {
  selected: Inquiry;
  notiz: string;
  setNotiz: (v: string) => void;
  saving: boolean;
  onSaveNotiz: () => void;
  onUpdateStatus: (id: string, s: string) => void;
  onCreateOrder: () => void;
  onClose?: () => void;
  navigate: (path: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5">
      {onClose && (
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">{selected.name}</p>
          <p className="text-xs text-muted-foreground">{selected.quelle ?? "website"}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <a href={`mailto:${selected.email}`} className="text-primary hover:underline truncate">{selected.email}</a>
        </div>
        {selected.telefon && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <a href={`tel:${selected.telefon}`} className="text-primary hover:underline">{selected.telefon}</a>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{new Date(selected.created_at).toLocaleString("de-CH")}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>Herkunft: {selected.herkunft || "–"}</span>
        </div>
      </div>

      <InquiryChat
        inquiryId={selected.id}
        customerName={selected.name}
        initialMessage={selected.nachricht}
        initialFrom={selected.email}
        initialAt={selected.created_at}
      />

      {selected.ki_beratung_zusammenfassung && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">KI-Materialberatung</p>
          <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{selected.ki_beratung_zusammenfassung}</pre>
        </div>
      )}

      {selected.attachments && selected.attachments.length > 0 && (

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Anhänge ({selected.attachments.length})
          </p>
          <div className="space-y-1.5">
            {selected.attachments.map((att, i) => (
              <button
                key={i}
                onClick={() => downloadAttachment(att)}
                className="w-full flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <Download className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{att.filename}</p>
                  {att.size_bytes && <p className="text-[10px] text-muted-foreground">{formatBytes(att.size_bytes)}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">Herunterladen</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => onUpdateStatus(selected.id, s)}
              className={`text-xs px-2.5 py-1.5 rounded-full border font-medium transition-all ${selected.status === s ? STATUS_COLORS[s] : "border-border text-muted-foreground hover:border-primary/40"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Interne Notiz</p>
        <Textarea
          value={notiz}
          onChange={e => setNotiz(e.target.value)}
          placeholder="Notizen zur Anfrage..."
          rows={3}
          className="text-sm"
        />
        <Button onClick={onSaveNotiz} disabled={saving} size="sm" className="mt-2 w-full" variant="outline">
          {saving ? "Speichern..." : "Notiz speichern"}
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        {selected.order_id ? (
          <Button size="sm" className="w-full gap-2" variant="outline" onClick={() => navigate(`/admin/auftraege/${selected.order_id}`)}>
            <ExternalLink className="w-3.5 h-3.5" /> Zum Auftrag
          </Button>
        ) : (
          <Button size="sm" className="w-full gap-2" onClick={onCreateOrder}>
            <Plus className="w-3.5 h-3.5" /> Auftrag erstellen
          </Button>
        )}
        {selected.customer_id && (
          <Button size="sm" className="w-full gap-2" variant="ghost" onClick={() => navigate(`/admin/kunden/${selected.customer_id}`)}>
            <User className="w-3.5 h-3.5" /> Kundenprofil öffnen
          </Button>
        )}
        <Button size="sm" className="w-full gap-2" variant="outline" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" /> Löschen
        </Button>
      </div>
    </div>
  );
}

export default function AnfragenPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("alle");
  const [herkunftFilter, setHerkunftFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creatingOrderFor, setCreatingOrderFor] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingInquiry, setDeletingInquiry] = useState<Inquiry | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("inquiries")
      .select("*, attachments")
      .order("created_at", { ascending: false });
    if (data) setInquiries(data as Inquiry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await (supabase.from as any)("inquiries").update({ status }).eq("id", id);
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev);
  };

  const saveNotiz = async () => {
    if (!selected) return;
    setSaving(true);
    await (supabase.from as any)("inquiries").update({ notiz }).eq("id", selected.id);
    setInquiries(prev => prev.map(i => i.id === selected.id ? { ...i, notiz } : i));
    setSelected(prev => prev ? { ...prev, notiz } : prev);
    setSaving(false);
    toast({ title: "Notiz gespeichert" });
  };

  const createOrder = async (inquiry?: Inquiry) => {
    const inq = inquiry || selected;
    if (!inq) return;

    setCreatingOrderFor(inq.id);
    try {
      let customerId = inq.customer_id;
      if (!customerId && inq.email) {
        const { data: customer } = await supabase
          .from("customers").select("id").eq("email", inq.email).maybeSingle();
        customerId = customer?.id ?? null;
      }
      if (!customerId) {
        // Vor- und Nachname aus inq.name splitten
        const nameParts = (inq.name || "").trim().split(/\s+/);
        const vorname = nameParts[0] || "";
        const nachname = nameParts.slice(1).join(" ") || "";
        const { data, error: custErr } = await supabase.from("customers")
          .insert({
            vorname,
            name: nachname || vorname,
            email: inq.email,
            telefon: inq.telefon,
          } as any)
          .select("id").single();
        if (custErr) {
          console.error("Customer insert error:", custErr);
          toast({ title: "Fehler beim Erstellen des Kunden", description: custErr.message, variant: "destructive" });
          return;
        }
        customerId = data?.id ?? null;
      }

      // AI-generierter Auftragstitel
      const attachmentsRaw = (inq.attachments || []) as Attachment[];
      const filenames = attachmentsRaw.map(a => a.filename).filter(Boolean);
      let aiTitle: string | null = null;
      try {
        const { data: titleData } = await supabase.functions.invoke("generate-order-title", {
          body: { filenames, nachricht: inq.nachricht, betreff: inq.betreff },
        });
        if (titleData?.title) aiTitle = titleData.title;
      } catch (e) {
        console.warn("AI Titel fehlgeschlagen", e);
      }
      const fallbackTitle = filenames[0]?.replace(/\.[^.]+$/, "") || inq.betreff || ("Anfrage vom " + new Date().toLocaleDateString("de-CH"));

      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        customer_id: customerId,
        beschreibung: inq.nachricht || inq.betreff || "",
        datum: new Date().toISOString().split("T")[0],
        status: "Offen",
        source: "website",
        name: aiTitle || fallbackTitle,
      } as any).select().single();

      if (orderErr || !order) {
        console.error("Order insert error:", orderErr);
        toast({ title: "Fehler beim Erstellen des Auftrags", description: orderErr?.message || "Unbekannter Fehler", variant: "destructive" });
        return;
      }

      const attachments = (inq.attachments || []) as Attachment[];

      const mimeMap: Record<string, string> = {
        stl: "model/stl", "3mf": "model/3mf", obj: "model/obj", step: "model/step",
        pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
        jpeg: "image/jpeg", webp: "image/webp",
      };

      if (attachments.length > 0) {
        // Create each part individually so we can attach its file directly via the returned id
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          const teilname = att.filename?.replace(/\.[^.]+$/, "") || `Teil ${i + 1}`;

          const sl = att as unknown as {
            slicer_druckzeit_sekunden?: number | null;
            slicer_filament_gramm?: number | null;
            slicer_hat_supports?: boolean | null;
            slicer_layer_anzahl?: number | null;
          };
          const slSeconds = sl.slicer_druckzeit_sekunden ?? null;
          const slGrams = sl.slicer_filament_gramm ?? null;

          const { data: part, error: partErr } = await supabase.from("parts").insert({
            order_id: order.id,
            customer_id: customerId,
            teilname,
            material: "PLA",
            menge: 1,
            gewicht_g: slGrams ?? 0,
            druckzeit_h: slSeconds ? Math.round((slSeconds / 3600) * 100) / 100 : 0,
            nachbearbeitung_h: 0,
            konstruktion_h: 0,
            preis_pro_stueck: 0,
            preis_total: 0,
            status: "Ausstehend",
            notizen: `Datei: ${att.filename}`,
            slicer_druckzeit_sekunden: slSeconds,
            slicer_filament_gramm: slGrams,
            slicer_hat_supports: sl.slicer_hat_supports ?? null,
            slicer_layer_anzahl: sl.slicer_layer_anzahl ?? null,
          } as any).select().single();


          if (partErr || !part) {
            console.error("Part insert error:", partErr);
            continue;
          }
          if (!att.storage_path) continue;

          try {
            const { data: fileData, error: dlErr } = await supabase.storage
              .from(att.bucket || "project-uploads")
              .download(att.storage_path);

            if (dlErr || !fileData) {
              console.error("Download fehlgeschlagen:", att.filename, dlErr);
              continue;
            }

            const ext = att.filename?.split(".").pop()?.toLowerCase() || "";
            const fileType = (fileData as Blob).type || mimeMap[ext] || "application/octet-stream";

            const safeName = (att.filename || "datei").replace(/[^\w.\-]+/g, "_");
            const newPath = `${order.id}/${part.id}/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("part-files")
              .upload(newPath, fileData, { upsert: true, contentType: fileType });

            if (upErr) {
              console.error("Upload fehlgeschlagen:", att.filename, upErr);
              continue;
            }

            const { error: insErr } = await supabase.from("part_files").insert({
              part_id: part.id,
              order_id: order.id,
              customer_id: customerId,
              filename: att.filename,
              storage_path: newPath,
              file_type: fileType,
              file_size_bytes: att.size_bytes ?? (fileData as Blob).size ?? null,
            });
            if (insErr) console.error("part_files insert error:", insErr);
          } catch (e) {
            console.error("Datei kopieren fehlgeschlagen:", att.filename, e);
          }
        }
      } else {
        await supabase.from("parts").insert({
          order_id: order.id,
          customer_id: customerId,
          teilname: "Teil 1",
          material: "PLA",
          menge: 1,
          gewicht_g: 0,
          druckzeit_h: 0,
          nachbearbeitung_h: 0,
          konstruktion_h: 0,
          preis_pro_stueck: 0,
          preis_total: 0,
          status: "Ausstehend",
          notizen: "",
        });
      }

      await (supabase.from as any)("inquiries")
        .update({ order_id: order.id, status: "In Bearbeitung" })
        .eq("id", inq.id);

      toast({ title: "Auftrag erstellt ✓" });
      navigate(`/admin/auftraege/${order.id}`);
    } catch (e: any) {
      console.error("createOrder error:", e);
      toast({ title: "Fehler", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setCreatingOrderFor(null);
    }
  };

  const handleSelect = (inq: Inquiry) => {
    if (inq.customer_id) {
      navigate(`/admin/kunden/${inq.customer_id}?tab=anfragen&inquiry=${inq.id}`);
      return;
    }
    setSelected(inq);
    setNotiz(inq.notiz || "");
    if (isMobile) setSheetOpen(true);
  };

  const handleDeleteInquiry = async (inq: Inquiry) => {
    setDeletingInquiry(inq);
    try {
      // Delete attachments from storage
      if (inq.attachments && inq.attachments.length > 0) {
        const paths = inq.attachments
          .map(a => a.storage_path)
          .filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from("project-uploads").remove(paths);
        }
      }
      // Delete related messages
      await (supabase.from as any)("inquiry_messages").delete().eq("inquiry_id", inq.id);
      // Delete inquiry
      await (supabase.from as any)("inquiries").delete().eq("id", inq.id);
      setInquiries(prev => prev.filter(i => i.id !== inq.id));
      if (selected?.id === inq.id) setSelected(null);
      setSheetOpen(false);
      toast({ title: "Anfrage gelöscht" });
    } catch (e: any) {
      console.error("Delete inquiry error:", e);
      toast({ title: "Fehler beim Löschen", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setDeletingInquiry(null);
      setShowDeleteDialog(false);
    }
  };

  const byStatus = filter === "alle" ? inquiries : inquiries.filter(i => i.status === filter);
  const filtered = herkunftFilter ? byStatus.filter(i => i.herkunft === herkunftFilter) : byStatus;
  const newCount = inquiries.filter(i => i.status === "Neu").length;

  const herkunftCounts = Object.entries(
    inquiries.reduce<Record<string, number>>((acc, i) => {
      if (i.herkunft) acc[i.herkunft] = (acc[i.herkunft] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const herkunftTotal = herkunftCounts.reduce((s, [, n]) => s + n, 0);

  return (
    <div className={`${isMobile ? "flex flex-col h-full" : "flex h-full gap-0"}`}>
      {/* Liste */}
      <div className={`${isMobile ? "flex-1 overflow-y-auto" : "flex-1 overflow-y-auto"} p-4 md:p-6 space-y-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Anfragen</h1>
            {newCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{newCount} neu</span>
            )}
          </div>
          <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["alle", ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {s === "alle" ? "Alle" : s}
              {s !== "alle" && ` (${inquiries.filter(i => i.status === s).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Keine Anfragen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inq => (
              <div
                key={inq.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(inq)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(inq); } }}
                className={`w-full text-left bg-card border rounded-xl p-4 hover:border-primary/40 transition-all active:bg-muted/40 cursor-pointer ${selected?.id === inq.id && !isMobile ? "border-primary/60 shadow-sm" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">{inq.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_COLORS[inq.status] ?? STATUS_COLORS["Neu"]}`}>{inq.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium flex items-center gap-1.5">
                      {inq.betreff}
                    </p>
                    {inq.attachments && inq.attachments.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Paperclip className="w-3 h-3" />
                        {inq.attachments.length} Datei{inq.attachments.length > 1 ? 'en' : ''}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-1">{inq.nachricht}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(inq.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                    {isMobile && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-end" onClick={e => e.stopPropagation()}>
                  {inq.order_id ? (
                    <Button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/auftraege/${inq.order_id}`); }}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Zum Auftrag →
                    </Button>
                  ) : (
                    <Button
                      onClick={(e) => { e.stopPropagation(); createOrder(inq); }}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      disabled={creatingOrderFor === inq.id}
                    >
                      {creatingOrderFor === inq.id
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Erstellen...</>
                        : <><Plus className="w-3.5 h-3.5" /> Auftrag erstellen</>
                      }
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Mobile: Sheet / Desktop: Side-Panel */}
      {isMobile ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 bg-background border-border overflow-hidden">
            {selected && (
              <InquiryDetail
                selected={selected}
                notiz={notiz}
                setNotiz={setNotiz}
                saving={saving}
                onSaveNotiz={saveNotiz}
                onUpdateStatus={updateStatus}
                onCreateOrder={() => createOrder()}
                onClose={() => setSheetOpen(false)}
                navigate={navigate}
                onDelete={() => { setShowDeleteDialog(true); }}
              />
            )}
          </SheetContent>
        </Sheet>
      ) : selected ? (
        <div className="w-96 border-l border-border overflow-y-auto bg-card/30">
          <InquiryDetail
            selected={selected}
            notiz={notiz}
            setNotiz={setNotiz}
            saving={saving}
            onSaveNotiz={saveNotiz}
            onUpdateStatus={updateStatus}
            onCreateOrder={() => createOrder()}
            navigate={navigate}
            onDelete={() => { setShowDeleteDialog(true); }}
          />
        </div>
      ) : (
        <div className="w-96 border-l border-border flex items-center justify-center text-muted-foreground bg-card/30">
          <div className="text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Anfrage auswählen</p>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfrage wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dies löscht die Anfrage inklusive aller Nachrichten und Dateianhänge unwiderruflich.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selected && handleDeleteInquiry(selected)}
              disabled={!!deletingInquiry}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingInquiry ? "Löschen..." : "Ja, löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
