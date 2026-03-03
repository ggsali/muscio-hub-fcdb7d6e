import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Building2, Globe, UserPlus, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/calc";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  vorname: string | null;
  firma: string | null;
  email: string | null;
  telefon: string | null;
  aktiv: boolean;
  order_count?: number;
  total_umsatz?: number;
}

interface WebsiteProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  email?: string;
}

type TabType = "kunden" | "website";

export default function KundenPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<WebsiteProfile[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"alle" | "aktiv" | "inaktiv">("alle");
  const [tab, setTab] = useState<TabType>("kunden");
  const [loading, setLoading] = useState(true);
  const [customerEmails, setCustomerEmails] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cData }, { data: pData }] = await Promise.all([
      supabase.from("customers").select("*, orders(umsatz_total)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);

    if (cData) {
      const enriched = cData.map(c => ({
        ...c,
        order_count: (c.orders as any[])?.length || 0,
        total_umsatz: (c.orders as any[])?.reduce((s: number, o: any) => s + (o.umsatz_total || 0), 0) || 0,
      }));
      setCustomers(enriched);
      const emailMap = new Map(cData.filter(c => c.email).map(c => [c.email!, c.id]));
      setCustomerEmails(emailMap);
    }

    if (pData) setProfiles(pData as any);
    setLoading(false);
  };

  const handleImport = async (k: WebsiteProfile) => {
    const nameParts = (k.full_name || "").trim().split(" ");
    const vorname = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : null;
    const name = nameParts[nameParts.length - 1] || k.full_name || "Unbekannt";

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name,
        vorname: vorname || null,
        telefon: k.phone || null,
        ort: k.city || null,
        plz: k.postal_code || null,
        land: k.country || "Schweiz",
        strasse: k.address || null,
        aktiv: true,
      })
      .select()
      .single();

    if (error) { toast.error("Fehler beim Importieren"); return; }
    toast.success(`${k.full_name || "Kunde"} importiert`);
    loadAll();
    navigate(`/kunden/${data.id}`);
  };

  const filtered = customers.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.vorname || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.firma || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "alle" ||
      (filter === "aktiv" && c.aktiv) ||
      (filter === "inaktiv" && !c.aktiv);
    return matchSearch && matchFilter;
  });

  const filteredProfiles = profiles.filter(p =>
    (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.city || "").toLowerCase().includes(search.toLowerCase())
  );

  // Count website profiles not yet imported
  const notImported = profiles.filter(p => {
    // We don't have emails on profiles in this schema, so just show all
    return true;
  }).length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{customers.length} Kunden · {profiles.length} Website-Registrierungen</p>
        </div>
        {tab === "kunden" && (
          <Button onClick={() => navigate("/kunden/neu")} className="bg-primary hover:bg-primary/90 gap-2" size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4" />
            {isMobile ? "Neu" : "Neuer Kunde"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("kunden")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "kunden" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Kunden
        </button>
        <button
          onClick={() => setTab("website")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5 ${tab === "website" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="w-3.5 h-3.5" />
          Website
          {profiles.length > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
              {profiles.length}
            </span>
          )}
        </button>
      </div>

      {/* Search & filters (Kunden tab only) */}
      {tab === "kunden" && (
        <div className="flex flex-col gap-2.5">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name oder Firma suchen..."
              className="pl-9 bg-input border-border w-full"
            />
          </div>
          <div className="flex gap-1.5">
            {(["alle", "aktiv", "inaktiv"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Website search */}
      {tab === "website" && (
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name oder Ort suchen..."
            className="pl-9 bg-input border-border w-full"
          />
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
      ) : tab === "kunden" ? (
        /* ---- KUNDEN TAB ---- */
        isMobile ? (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Keine Kunden gefunden</div>
            ) : filtered.map(c => (
              <div
                key={c.id}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer active:bg-muted/40 transition-colors"
                onClick={() => navigate(`/kunden/${c.id}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{[c.vorname, c.name].filter(Boolean).join(" ")}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.aktiv ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {c.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                    {c.firma && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span>{c.firma}</span>
                      </div>
                    )}
                    {c.email && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.email}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold">{formatCHF(c.total_umsatz || 0)}</span>
                    <span className="text-xs text-muted-foreground">{c.order_count} Aufträge</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Keine Kunden gefunden</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Name", "Firma", "E-Mail", "Telefon", "Aufträge", "Gesamtumsatz", "Status"].map(h => (
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
                      onClick={() => navigate(`/kunden/${c.id}`)}
                    >
                      <td className="px-5 py-3 font-medium">{[c.vorname, c.name].filter(Boolean).join(" ")}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.firma || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.telefon || "—"}</td>
                      <td className="px-5 py-3">{c.order_count}</td>
                      <td className="px-5 py-3 num-right">{formatCHF(c.total_umsatz || 0)}</td>
                      <td className="px-5 py-3">
                        <span className={`status-badge ${c.aktiv ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                          {c.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      ) : (
        /* ---- WEBSITE TAB ---- */
        <div className="space-y-3">
          {filteredProfiles.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold mb-2">Noch keine Website-Registrierungen</h3>
              <p className="text-sm text-muted-foreground">
                Sobald sich Kunden auf der 3D Print Studio Website registrieren, erscheinen sie hier.
              </p>
            </div>
          ) : filteredProfiles.map(k => (
            <div key={k.user_id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{k.full_name || "Unbekannt"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Website</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {k.phone && (
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{k.phone}</span>
                  )}
                  {(k.city || k.postal_code) && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[k.postal_code, k.city].filter(Boolean).join(" ")}</span>
                  )}
                  <span>Registriert {formatDistanceToNow(new Date(k.created_at), { addSuffix: true, locale: de })}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => handleImport(k)} className="gap-1.5 text-xs flex-shrink-0">
                <UserPlus className="w-3.5 h-3.5" />
                Importieren
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
