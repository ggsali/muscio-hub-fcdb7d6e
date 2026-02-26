import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF, formatPct } from "@/lib/calc";
import { ArrowLeft, Edit2, Save, X, Download, Trash2, FileText, Image, Box } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  firma: string;
  email: string;
  telefon: string;
  adresse: string;
  notizen: string;
  aktiv: boolean;
}

interface Order {
  id: string;
  datum: string;
  beschreibung: string;
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

export default function KundeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "neu";

  const [customer, setCustomer] = useState<Customer>({
    id: "", name: "", firma: "", email: "", telefon: "", adresse: "", notizen: "", aktiv: true,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [editing, setEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState<"kontakt" | "auftraege" | "teile" | "dateien">("kontakt");
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const { data: c } = await supabase.from("customers").select("*").eq("id", id!).single();
      if (c) setCustomer(c);

      const { data: o } = await supabase.from("orders").select("*").eq("customer_id", id!).order("datum", { ascending: false });
      if (o) setOrders(o);

      const { data: p } = await supabase.from("parts").select("*").eq("customer_id", id!).order("created_at", { ascending: false });
      if (p) setParts(p);

      setLoading(false);
    }
    load();
  }, [id]);

  const handleSave = async () => {
    if (isNew) {
      const { data } = await supabase.from("customers").insert({
        name: customer.name, firma: customer.firma, email: customer.email,
        telefon: customer.telefon, adresse: customer.adresse, notizen: customer.notizen, aktiv: customer.aktiv,
      }).select().single();
      if (data) navigate(`/kunden/${data.id}`, { replace: true });
    } else {
      await supabase.from("customers").update({
        name: customer.name, firma: customer.firma, email: customer.email,
        telefon: customer.telefon, adresse: customer.adresse, notizen: customer.notizen,
      }).eq("id", id!);
      setEditing(false);
    }
  };

  const totalUmsatz = orders.reduce((s, o) => s + o.umsatz_total, 0);
  const totalGewinn = orders.reduce((s, o) => s + o.gewinn_total, 0);
  const avgMarge = orders.length ? orders.reduce((s, o) => s + o.marge, 0) / orders.length : 0;

  if (loading) return <div className="p-8 text-muted-foreground">Laden...</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/kunden")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isNew ? "Neuer Kunde" : customer.name}</h1>
          {!isNew && customer.firma && <p className="text-muted-foreground text-sm">{customer.firma}</p>}
        </div>
        {!isNew && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)} className="gap-2 border-border">
            <Edit2 className="w-4 h-4" />Bearbeiten
          </Button>
        )}
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 border-b border-border">
          {(["kontakt", "auftraege", "teile"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "auftraege" ? "Auftragshistorie" : tab === "teile" ? "Teile" : "Kontakt"}
            </button>
          ))}
        </div>
      )}

      {/* Kontakt Tab */}
      {(isNew || activeTab === "kontakt") && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} disabled={!editing} className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Firma</Label>
              <Input value={customer.firma} onChange={e => setCustomer({ ...customer, firma: e.target.value })} disabled={!editing} className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} disabled={!editing} className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={customer.telefon} onChange={e => setCustomer({ ...customer, telefon: e.target.value })} disabled={!editing} className="bg-input border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input value={customer.adresse} onChange={e => setCustomer({ ...customer, adresse: e.target.value })} disabled={!editing} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={customer.notizen} onChange={e => setCustomer({ ...customer, notizen: e.target.value })} disabled={!editing} className="bg-input border-border" rows={3} />
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
                  {["Datum", "Beschreibung", "Umsatz", "Gewinn", "Marge", "Status"].map(h => (
                    <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${["Umsatz", "Gewinn", "Marge"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="table-row-alt border-b border-border/50 last:border-0" onClick={() => navigate(`/auftraege/${o.id}`)}>
                    <td className="px-5 py-3 text-muted-foreground">{o.datum}</td>
                    <td className="px-5 py-3">{o.beschreibung || "—"}</td>
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
