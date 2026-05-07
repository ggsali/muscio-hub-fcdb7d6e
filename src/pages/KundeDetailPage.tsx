import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import InquiryChat from "@/components/InquiryChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF, formatPct } from "@/lib/calc";
import { toast } from "sonner";
import { ArrowLeft, Edit2, Save, X, Download, FileText, Image, Box, Plus, MoreVertical, Trash2, MessageSquare } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Customer {
  id: string;
  vorname: string;
  name: string;
  firma: string;
  email: string;
  telefon: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  adresse: string; // legacy
  notizen: string;
  aktiv: boolean;
}

interface Order {
  id: string;
  datum: string;
  beschreibung: string;
  name: string | null;
  umsatz_total: number;
  gewinn_total: number;
  marge: number;
  status: string;
}

interface Part {
  id: string;
  teilname: string;
  material: string;
  gewicht_g: number;
  druckzeit_h: number;
  preis_pro_stueck: number;
  created_at: string;
  order_id: string;
}

interface CustomerFile {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
  part_id: string | null;
  order_id: string | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type?.startsWith("image")) return <Image className="w-4 h-4 text-primary" />;
  if (type?.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  return <Box className="w-4 h-4 text-muted-foreground" />;
}

const emptyCustomer = (): Customer => ({
  id: "", vorname: "", name: "", firma: "", email: "", telefon: "",
  strasse: "", hausnummer: "", plz: "", ort: "", land: "Schweiz",
  adresse: "", notizen: "", aktiv: true,
});

type Attachment = { filename: string; storage_path: string; bucket?: string; size_bytes?: number | null };
type InquiryRow = {
  id: string; name: string; email: string; telefon: string | null;
  betreff: string | null; nachricht: string; status: string; notiz: string | null;
  created_at: string; order_id: string | null; attachments?: Attachment[] | null;
};

async function downloadInquiryAttachment(att: Attachment) {
  const bucket = att.bucket || "project-uploads";
  const { data } = await supabase.storage.from(bucket).createSignedUrl(att.storage_path, 600);
  if (!data?.signedUrl) return;
  const a = document.createElement("a");
  a.href = data.signedUrl; a.download = att.filename; a.target = "_blank";
  document.body.appendChild(a); a.click(); a.remove();
}

function formatBytesAtt(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function KundeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNew = id === "neu";

  const initialTab = (searchParams.get("tab") as any) || "kontakt";
  const initialInquiry = searchParams.get("inquiry");

  const [customer, setCustomer] = useState<Customer>(emptyCustomer());
  const [orders, setOrders] = useState<Order[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(initialInquiry);
  const [editing, setEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState<"kontakt" | "auftraege" | "teile" | "dateien" | "anfragen">(initialTab);
  const [loading, setLoading] = useState(!isNew);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const { data: c } = await supabase.from("customers").select("*").eq("id", id!).single();
      if (c) setCustomer({ ...emptyCustomer(), ...(c as any) });

      const { data: o } = await supabase.from("orders").select("*").eq("customer_id", id!).order("datum", { ascending: false });
      if (o) setOrders(o as Order[]);

      const { data: p } = await supabase.from("parts").select("*").eq("customer_id", id!).order("created_at", { ascending: false });
      if (p) setParts(p as Part[]);

      const { data: f } = await supabase.from("part_files").select("*").eq("customer_id", id!).order("created_at", { ascending: false });
      if (f) setFiles(f as CustomerFile[]);

      // Anfragen: nach customer_id ODER E-Mail
      const email = (c as any)?.email;
      let q = supabase.from("inquiries").select("*").order("created_at", { ascending: false });
      if (email) {
        q = q.or(`customer_id.eq.${id},email.eq.${email}`);
      } else {
        q = q.eq("customer_id", id!);
      }
      const { data: inqs } = await q;
      if (inqs) setInquiries(inqs as unknown as InquiryRow[]);

      setLoading(false);
    }
    load();
  }, [id]);

  const getFullAdresse = () => {
    const parts = [];
    if (customer.strasse || customer.hausnummer) parts.push(`${customer.strasse || ""} ${customer.hausnummer || ""}`.trim());
    if (customer.plz || customer.ort) parts.push(`${customer.plz || ""} ${customer.ort || ""}`.trim());
    if (customer.land && customer.land !== "Schweiz") parts.push(customer.land);
    return parts.join(", ");
  };

  const handleSave = async () => {
    if (!customer.name?.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    const payload = {
      vorname: customer.vorname || null,
      name: customer.name,
      firma: customer.firma || null,
      email: customer.email || null,
      telefon: customer.telefon || null,
      strasse: customer.strasse || null,
      hausnummer: customer.hausnummer || null,
      plz: customer.plz || null,
      ort: customer.ort || null,
      land: customer.land || "Schweiz",
      adresse: getFullAdresse() || customer.adresse || null,
      notizen: customer.notizen || null,
      aktiv: customer.aktiv,
    };

    if (isNew) {
      const { data, error } = await supabase.from("customers").insert(payload).select().single();
      if (error) { toast.error("Fehler beim Speichern: " + error.message); return; }
      toast.success("Kunde erstellt");
      if (data) navigate(`/admin/kunden/${data.id}`, { replace: true });
    } else {
      const { data, error } = await supabase.from("customers").update(payload).eq("id", id!).select().single();
      if (error) { toast.error("Fehler beim Speichern: " + error.message); return; }
      if (data) setCustomer({ ...emptyCustomer(), ...(data as any) });
      toast.success("Änderungen gespeichert");
      setEditing(false);
    }
  };

  const totalUmsatz = orders.reduce((s, o) => s + o.umsatz_total, 0);
  const totalGewinn = orders.reduce((s, o) => s + o.gewinn_total, 0);
  const avgMarge = orders.length ? orders.reduce((s, o) => s + o.marge, 0) / orders.length : 0;

  if (loading) return <div className="p-8 text-muted-foreground">Laden...</div>;

  const handleDelete = async () => {
    if (!id || isNew) return;
    await supabase.from("part_files").delete().eq("customer_id", id);
    await supabase.from("parts").delete().eq("customer_id", id);
    await supabase.from("inquiries").delete().eq("customer_id", id);
    await supabase.from("orders").delete().eq("customer_id", id);
    await supabase.from("customers").delete().eq("id", id);
    navigate("/admin/kunden");
  };

  const field = (label: string, key: keyof Customer, placeholder?: string, colSpan = 1) => (
    <div className={`space-y-1.5 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      <Input
        value={(customer[key] as string) || ""}
        onChange={e => setCustomer({ ...customer, [key]: e.target.value })}
        disabled={!editing}
        placeholder={placeholder}
        className="bg-input border-border"
      />
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin/kunden")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isNew ? "Neuer Kunde" : [customer.vorname, customer.name].filter(Boolean).join(" ") || customer.name}
          </h1>
          {!isNew && customer.firma && <p className="text-muted-foreground text-sm">{customer.firma}</p>}
        </div>
        {!isNew && !editing && (
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate(`/admin/auftraege/neu?customer_id=${id}`)} className="gap-2" size="sm">
              <Plus className="w-4 h-4" />Neuer Auftrag
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 border-border">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2">
                  <Edit2 className="w-4 h-4" /> Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4" /> Kunde löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vorgang löscht den Kunden sowie alle zugehörigen Aufträge, Teile und Dateien unwiderruflich.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Ja, löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 border-b border-border">
          {(["kontakt", "anfragen", "auftraege", "teile", "dateien"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchParams(tab === "kontakt" ? {} : { tab }); }}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "auftraege" ? "Auftragshistorie" : tab === "teile" ? "Teile" : tab === "dateien" ? `Dateien (${files.length})` : tab === "anfragen" ? `Anfragen (${inquiries.length})` : "Kontakt"}
            </button>
          ))}
        </div>
      )}

      {/* Kontakt Tab */}
      {(isNew || activeTab === "kontakt") && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-5 max-w-2xl">
          {/* Person */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Person</h3>
            <div className="grid grid-cols-2 gap-4">
              {field("Vorname", "vorname", "Max")}
              {field("Nachname *", "name", "Mustermann")}
              {field("Firma / Organisation", "firma", "Mustermann GmbH", 2)}
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kontakt</h3>
            <div className="grid grid-cols-2 gap-4">
              {field("E-Mail", "email", "max@beispiel.ch")}
              {field("Telefon", "telefon", "+41 79 123 45 67")}
            </div>
          </div>

          {/* Adresse */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Adresse</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-1.5">
                <Label>Strasse</Label>
                <Input value={customer.strasse || ""} onChange={e => setCustomer({ ...customer, strasse: e.target.value })} disabled={!editing} placeholder="Musterstrasse" className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Nr.</Label>
                <Input value={customer.hausnummer || ""} onChange={e => setCustomer({ ...customer, hausnummer: e.target.value })} disabled={!editing} placeholder="12a" className="bg-input border-border" />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>PLZ</Label>
                <Input value={customer.plz || ""} onChange={e => setCustomer({ ...customer, plz: e.target.value })} disabled={!editing} placeholder="8000" className="bg-input border-border" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Ort</Label>
                <Input value={customer.ort || ""} onChange={e => setCustomer({ ...customer, ort: e.target.value })} disabled={!editing} placeholder="Zürich" className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Land</Label>
                <Input value={customer.land || "Schweiz"} onChange={e => setCustomer({ ...customer, land: e.target.value })} disabled={!editing} className="bg-input border-border" />
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={customer.notizen || ""} onChange={e => setCustomer({ ...customer, notizen: e.target.value })} disabled={!editing} className="bg-input border-border" rows={3} />
          </div>

          {editing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2">
                <Save className="w-4 h-4" />Speichern
              </Button>
              {!isNew && (
                <Button variant="outline" onClick={() => setEditing(false)} className="gap-2 border-border">
                  <X className="w-4 h-4" />Abbrechen
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Anfragen Tab */}
      {activeTab === "anfragen" && !isNew && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-1">
            {inquiries.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
                Keine Anfragen
              </div>
            ) : inquiries.map(inq => (
              <button
                key={inq.id}
                onClick={() => setSelectedInquiryId(inq.id)}
                className={`w-full text-left bg-card border rounded-lg p-3 hover:border-primary/40 transition-all ${selectedInquiryId === inq.id ? "border-primary/60" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{inq.betreff || "Anfrage"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">{inq.status}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{inq.nachricht}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(inq.created_at).toLocaleString("de-CH")}</p>
              </button>
            ))}
          </div>
          <div className="md:col-span-2">
            {(() => {
              const sel = inquiries.find(i => i.id === selectedInquiryId) || inquiries[0];
              if (!sel) return (
                <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" /> Anfrage auswählen
                </div>
              );
              return (
                <div className="space-y-3">
                  <InquiryChat
                    inquiryId={sel.id}
                    customerName={sel.name}
                    initialMessage={sel.nachricht}
                    initialFrom={sel.email}
                    initialAt={sel.created_at}
                  />
                  {sel.attachments && sel.attachments.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Anhänge ({sel.attachments.length})</p>
                      <div className="space-y-1.5">
                        {sel.attachments.map((att, i) => (
                          <button
                            key={i}
                            onClick={() => downloadInquiryAttachment(att)}
                            className="w-full flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                          >
                            <Download className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{att.filename}</p>
                              {att.size_bytes ? <p className="text-[10px] text-muted-foreground">{formatBytesAtt(att.size_bytes)}</p> : null}
                            </div>
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">Herunterladen</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Auftraege Tab */}
      {activeTab === "auftraege" && !isNew && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="kpi-card">
              <div className="text-xs text-muted-foreground">Umsatz Total</div>
              <div className="text-lg font-bold">{formatCHF(totalUmsatz)}</div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-muted-foreground">Gewinn Total</div>
              <div className="text-lg font-bold text-success">{formatCHF(totalGewinn)}</div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-muted-foreground">Ø Marge</div>
              <div className="text-lg font-bold">{formatPct(avgMarge)}</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Datum", "Auftragsname", "Beschreibung", "Umsatz", "Gewinn", "Marge", "Status"].map(h => (
                    <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${["Umsatz", "Gewinn", "Marge"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="table-row-alt border-b border-border/50 last:border-0 cursor-pointer" onClick={() => navigate(`/admin/auftraege/${o.id}`)}>
                    <td className="px-5 py-3 text-muted-foreground">{o.datum}</td>
                    <td className="px-5 py-3 font-medium">{o.name || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{o.beschreibung || "—"}</td>
                    <td className="px-5 py-3 num-right">{formatCHF(o.umsatz_total)}</td>
                    <td className="px-5 py-3 num-right text-success">{formatCHF(o.gewinn_total)}</td>
                    <td className="px-5 py-3 num-right">{formatPct(o.marge)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dateien Tab */}
      {activeTab === "dateien" && !isNew && (
        <div className="space-y-2">
          {files.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
              Keine Dateien für diesen Kunden vorhanden.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Datei", "Typ", "Grösse", "Auftrag", "Datum", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-muted-foreground font-medium text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.id} className="table-row-alt border-b border-border/50 last:border-0 group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {fileIcon(f.file_type)}
                          <span className="font-medium truncate max-w-[200px]">{f.filename}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{f.file_type?.split("/")[1]?.toUpperCase() ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatBytes(f.file_size_bytes)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {f.order_id ? (
                          <button onClick={() => navigate(`/admin/auftraege/${f.order_id}`)} className="text-primary hover:underline text-xs">
                            Auftrag öffnen
                          </button>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(f.created_at).toLocaleDateString("de-CH")}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from("part-files").createSignedUrl(f.storage_path, 60);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
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
      )}

      {/* Teile Tab */}
      {activeTab === "teile" && !isNew && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Teilname", "Material", "Gewicht (g)", "Druckzeit (h)", "Preis", "Datum"].map(h => (
                  <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${["Gewicht (g)", "Druckzeit (h)", "Preis"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id} className="table-row-alt border-b border-border/50 last:border-0">
                  <td className="px-5 py-3 font-medium">{p.teilname}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.material}</td>
                  <td className="px-5 py-3 num-right">{p.gewicht_g}g</td>
                  <td className="px-5 py-3 num-right">{p.druckzeit_h}h</td>
                  <td className="px-5 py-3 num-right">{formatCHF(p.preis_pro_stueck)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("de-CH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
