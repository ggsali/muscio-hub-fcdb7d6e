import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Building2, Globe, Phone, MapPin, CheckCircle2, Briefcase, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/calc";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface OrderLite { status: string | null; umsatz_total: number | null; }

interface Customer {
  id: string;
  name: string;
  vorname: string | null;
  firma: string | null;
  email: string | null;
  telefon: string | null;
  ort: string | null;
  plz: string | null;
  aktiv: boolean;
  auth_user_id: string | null;
  created_at: string;
  orders: OrderLite[];
  order_count: number;
  open_count: number;
  total_umsatz: number;
}

type TabType = "aktiv" | "abgeschlossen" | "website";

const COMPLETED_STATUS = "Abgeschlossen";

export default function KundenPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabType>("aktiv");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-website-customers", {});
      if (error) throw error;
      toast.success("Sync erfolgreich", { description: `${data?.linked ?? 0} verknüpft, ${data?.created ?? 0} angelegt` });
      await loadAll();
    } catch (e: any) {
      toast.error("Sync fehlgeschlagen", { description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*, orders(status, umsatz_total)")
      .order("created_at", { ascending: false });

    if (data) {
      const enriched: Customer[] = (data as any[]).map(c => {
        const orders: OrderLite[] = (c.orders as OrderLite[]) || [];
        const open_count = orders.filter(o => (o.status || "") !== COMPLETED_STATUS).length;
        const total_umsatz = orders.reduce((s, o) => s + (Number(o.umsatz_total) || 0), 0);
        return { ...c, orders, order_count: orders.length, open_count, total_umsatz };
      });
      setCustomers(enriched);
    }
    setLoading(false);
  };

  const aktive = customers.filter(c => c.order_count > 0 && c.open_count > 0);
  const abgeschlossene = customers.filter(c => c.order_count > 0 && c.open_count === 0);
  const website = customers.filter(c => c.order_count === 0);

  const list = tab === "aktiv" ? aktive : tab === "abgeschlossen" ? abgeschlossene : website;

  const filtered = list.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.vorname || "").toLowerCase().includes(q) ||
      (c.firma || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.ort || "").toLowerCase().includes(q)
    );
  });

  const tabConfig: { key: TabType; label: string; icon: any; count: number }[] = [
    { key: "aktiv", label: "Aktive Aufträge", icon: Briefcase, count: aktive.length },
    { key: "abgeschlossen", label: "Abgeschlossen", icon: CheckCircle2, count: abgeschlossene.length },
    { key: "website", label: "Website", icon: Globe, count: website.length },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {customers.length} Kunden total · {aktive.length} aktiv · {abgeschlossene.length} abgeschlossen · {website.length} ohne Auftrag
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2" size={isMobile ? "sm" : "default"}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {isMobile ? "Sync" : "Website-Kunden synchronisieren"}
          </Button>
          <Button onClick={() => navigate("/admin/kunden/neu")} className="bg-primary hover:bg-primary/90 gap-2" size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4" />
            {isMobile ? "Neu" : "Neuer Kunde"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit flex-wrap">
        {tabConfig.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 md:px-4 py-1.5 text-xs md:text-sm rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name, Firma, E-Mail oder Ort suchen..."
          className="pl-9 bg-input border-border w-full"
        />
      </div>

      {loading ? (
        <div className="p-4 md:p-8 text-center text-muted-foreground text-sm">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          {tab === "website" ? <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" /> :
           tab === "abgeschlossen" ? <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" /> :
           <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />}
          <h3 className="font-semibold mb-2">
            {tab === "aktiv" && "Keine aktiven Aufträge"}
            {tab === "abgeschlossen" && "Keine abgeschlossenen Kunden"}
            {tab === "website" && "Keine Website-Registrierungen ohne Auftrag"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tab === "website"
              ? "Kunden, die sich auf der Website registrieren, erscheinen hier automatisch. Sobald sie einen Auftrag haben, wandern sie in „Aktive Aufträge“."
              : "Sobald passende Kunden vorhanden sind, erscheinen sie hier."}
          </p>
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {filtered.map(c => (
            <CustomerCard key={c.id} c={c} tab={tab} onClick={() => navigate(`/admin/kunden/${c.id}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {(tab === "website"
                  ? ["Name", "E-Mail", "Telefon", "Ort", "Registriert", ""]
                  : ["Name", "Firma", "E-Mail", "Telefon", tab === "aktiv" ? "Offen" : "Aufträge", "Gesamtumsatz", ""]
                ).map(h => (
                  <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${h === "Gesamtumsatz" ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className="table-row-alt border-b border-border/50 last:border-0 cursor-pointer"
                  onClick={() => navigate(`/admin/kunden/${c.id}`)}
                >
                  <td className="px-5 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {[c.vorname, c.name].filter(Boolean).join(" ") || "—"}
                      {c.auth_user_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Web</span>}
                    </div>
                  </td>
                  {tab === "website" ? (
                    <>
                      <td className="px-5 py-3 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.telefon || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{[c.plz, c.ort].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 text-muted-foreground">{c.firma || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.telefon || "—"}</td>
                      <td className="px-5 py-3">{tab === "aktiv" ? `${c.open_count} / ${c.order_count}` : c.order_count}</td>
                      <td className="px-5 py-3 num-right">{formatCHF(c.total_umsatz)}</td>
                    </>
                  )}
                  <td className="px-5 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomerCard({ c, tab, onClick }: { c: Customer; tab: TabType; onClick: () => void }) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-4 cursor-pointer active:bg-muted/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">{[c.vorname, c.name].filter(Boolean).join(" ") || "—"}</span>
            {c.auth_user_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Web</span>}
          </div>
          {c.firma && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" /><span>{c.firma}</span>
            </div>
          )}
          {c.email && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.email}</p>}
          {tab === "website" && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              {c.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefon}</span>}
              {(c.ort || c.plz) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[c.plz, c.ort].filter(Boolean).join(" ")}</span>}
              <span>Registriert {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {tab !== "website" && (
            <>
              <span className="text-sm font-bold">{formatCHF(c.total_umsatz)}</span>
              <span className="text-xs text-muted-foreground">
                {tab === "aktiv" ? `${c.open_count} offen` : `${c.order_count} Aufträge`}
              </span>
            </>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
