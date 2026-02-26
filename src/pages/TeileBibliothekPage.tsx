import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCHF } from "@/lib/calc";

interface Part {
  id: string;
  teilname: string;
  material: string;
  gewicht_g: number;
  druckzeit_h: number;
  preis_pro_stueck: number;
  created_at: string;
  order_id: string;
  customer_name: string;
}

export default function TeileBibliothekPage() {
  const navigate = useNavigate();
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("Alle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("parts")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });

      if (data) {
        setParts(data.map(p => ({
          ...p,
          customer_name: (p.customers as any)?.name || "—",
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  const materials = ["Alle", ...Array.from(new Set(parts.map(p => p.material)))];

  const filtered = parts.filter(p => {
    const matchSearch = p.teilname.toLowerCase().includes(search.toLowerCase()) ||
      p.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchMat = materialFilter === "Alle" || p.material === materialFilter;
    return matchSearch && matchMat;
  });

  // Stats
  const countByName = parts.reduce((acc, p) => {
    acc[p.teilname] = (acc[p.teilname] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topPart = Object.entries(countByName).sort((a, b) => b[1] - a[1])[0];
  const avgByMat = parts.reduce((acc, p) => {
    if (!acc[p.material]) acc[p.material] = { sum: 0, count: 0 };
    acc[p.material].sum += p.preis_pro_stueck;
    acc[p.material].count++;
    return acc;
  }, {} as Record<string, { sum: number; count: number }>);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Teile-Bibliothek</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{parts.length} Teile total</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {topPart && (
          <div className="kpi-card col-span-2">
            <div className="text-xs text-muted-foreground">Meistgedrucktes Teil</div>
            <div className="font-bold">{topPart[0]}</div>
            <div className="text-xs text-muted-foreground">{topPart[1]}× gedruckt</div>
          </div>
        )}
        {Object.entries(avgByMat).slice(0, 2).map(([mat, { sum, count }]) => (
          <div key={mat} className="kpi-card">
            <div className="text-xs text-muted-foreground">Ø Preis {mat}</div>
            <div className="font-bold">{formatCHF(sum / count)}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche..." className="pl-9 bg-input border-border" />
        </div>
        <div className="flex gap-1">
          {materials.map(m => (
            <button key={m} onClick={() => setMaterialFilter(m)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${materialFilter === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Teile gefunden</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Teilname", "Kunde", "Material", "Gewicht", "Druckzeit", "Preis", "Datum", "Auftrag"].map(h => (
                  <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${["Gewicht", "Druckzeit", "Preis"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="table-row-alt border-b border-border/50 last:border-0">
                  <td className="px-5 py-3 font-medium">{p.teilname}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.customer_name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{p.material}</span>
                  </td>
                  <td className="px-5 py-3 num-right">{p.gewicht_g}g</td>
                  <td className="px-5 py-3 num-right">{p.druckzeit_h}h</td>
                  <td className="px-5 py-3 num-right text-primary">{formatCHF(p.preis_pro_stueck)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("de-CH")}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => navigate(`/auftraege/${p.order_id}`)} className="text-xs text-primary hover:underline">
                      Anzeigen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
