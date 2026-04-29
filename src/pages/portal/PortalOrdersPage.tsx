import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF } from "@/lib/calc";
import { Package, Download } from "lucide-react";

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [bills, setBills] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data: cust } = await supabase.from("customers").select("id").eq("auth_user_id", u.user.id).maybeSingle();
      if (!cust) { setLoading(false); return; }
      const { data: ord } = await supabase
        .from("orders").select("*").eq("customer_id", cust.id).order("datum", { ascending: false });
      setOrders(ord || []);
      if (ord?.length) {
        const { data: b } = await supabase.from("bills").select("*").in("order_id", ord.map(o => o.id));
        const grouped: Record<string, any[]> = {};
        for (const bill of b || []) {
          if (!grouped[bill.order_id]) grouped[bill.order_id] = [];
          grouped[bill.order_id].push(bill);
        }
        setBills(grouped);
      }
      setLoading(false);
    })();
  }, []);

  const downloadBill = async (path: string, filename: string) => {
    const { data } = await supabase.storage.from("bills").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = filename;
      a.click();
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Meine Bestellungen</h1>
      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Noch keine Bestellungen vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{o.beschreibung || `Auftrag vom ${o.datum}`}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.datum}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatCHF(o.umsatz_total)}</div>
                  {o.tracking_nr && <div className="text-[10px] text-muted-foreground mt-1">Tracking: {o.tracking_nr}</div>}
                </div>
              </div>
              {bills[o.id]?.length > 0 && (
                <div className="border-t border-border pt-3 mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Rechnungen</p>
                  {bills[o.id].map(b => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span>{b.titel}</span>
                        {b.bezahlt && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">bezahlt</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatCHF(b.betrag)}</span>
                        {b.file_path && (
                          <button onClick={() => downloadBill(b.file_path, b.filename || "rechnung.pdf")} className="text-primary hover:underline flex items-center gap-1 text-xs">
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
