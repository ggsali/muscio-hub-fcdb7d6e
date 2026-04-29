import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Package, FileText, ArrowRight } from "lucide-react";
import { formatCHF } from "@/lib/calc";
import { StatusBadge } from "@/components/StatusBadge";

export default function PortalDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setName(u.user.user_metadata?.full_name || u.user.email?.split("@")[0] || "");

      const { data: cust } = await supabase
        .from("customers").select("id").eq("auth_user_id", u.user.id).maybeSingle();
      if (!cust) return;

      const { data: ord } = await supabase
        .from("orders").select("id, datum, beschreibung, umsatz_total, status")
        .eq("customer_id", cust.id).order("datum", { ascending: false }).limit(5);
      setOrders(ord || []);
    })();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Willkommen{name ? `, ${name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Hier siehst du deine Bestellungen und kannst neue Anfragen senden.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/kalkulator-online" className="group bg-card border border-border rounded-xl p-6 hover:border-primary transition-colors">
          <FileText className="w-6 h-6 text-primary mb-3" />
          <h3 className="font-semibold mb-1">Neue Anfrage</h3>
          <p className="text-sm text-muted-foreground">Preis kalkulieren und Anfrage senden.</p>
          <span className="inline-flex items-center gap-1 text-xs text-primary mt-3 group-hover:gap-2 transition-all">Zum Rechner <ArrowRight className="w-3 h-3" /></span>
        </Link>
        <Link to="/portal/bestellungen" className="group bg-card border border-border rounded-xl p-6 hover:border-primary transition-colors">
          <Package className="w-6 h-6 text-primary mb-3" />
          <h3 className="font-semibold mb-1">Bestellungen</h3>
          <p className="text-sm text-muted-foreground">Status verfolgen, Rechnungen einsehen.</p>
          <span className="inline-flex items-center gap-1 text-xs text-primary mt-3 group-hover:gap-2 transition-all">Alle anzeigen <ArrowRight className="w-3 h-3" /></span>
        </Link>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Letzte Bestellungen</h2>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Noch keine Bestellungen</div>
          ) : (
            <div className="divide-y divide-border/50">
              {orders.map(o => (
                <div key={o.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      <span className="text-xs text-muted-foreground">{o.datum}</span>
                    </div>
                    <p className="text-sm mt-1 truncate">{o.beschreibung || "—"}</p>
                  </div>
                  <span className="font-semibold text-sm">{formatCHF(o.umsatz_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
