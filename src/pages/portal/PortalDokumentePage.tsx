import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCHF } from "@/lib/calc";
import { FileText, Download, Receipt, FileCheck, FileSignature } from "lucide-react";

type Bill = {
  id: string;
  order_id: string | null;
  titel: string | null;
  betrag: number | null;
  notiz: string | null;
  file_path: string | null;
  filename: string | null;
  created_at: string;
};

type Order = {
  id: string;
  beschreibung: string | null;
  datum: string | null;
};

function iconFor(titel: string | null) {
  const t = (titel || "").toLowerCase();
  if (t.includes("offerte")) return FileSignature;
  if (t.includes("auftragsbest")) return FileCheck;
  if (t.includes("rechnung")) return Receipt;
  return FileText;
}

export default function PortalDokumentePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [billsByOrder, setBillsByOrder] = useState<Record<string, Bill[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data: cust } = await supabase
        .from("customers").select("id").eq("auth_user_id", u.user.id).maybeSingle();
      if (!cust) { setLoading(false); return; }

      const { data: ord } = await supabase
        .from("orders").select("id, beschreibung, datum")
        .eq("customer_id", cust.id)
        .order("datum", { ascending: false });
      const orderIds = (ord || []).map(o => o.id);
      if (orderIds.length === 0) { setOrders([]); setLoading(false); return; }

      const { data: bills } = await supabase
        .from("bills").select("*")
        .in("order_id", orderIds)
        .not("file_path", "is", null)
        .order("created_at", { ascending: false });

      const grouped: Record<string, Bill[]> = {};
      for (const b of (bills as Bill[] | null) || []) {
        if (!b.order_id) continue;
        (grouped[b.order_id] ||= []).push(b);
      }
      setBillsByOrder(grouped);
      // nur Aufträge mit Dokumenten anzeigen
      setOrders((ord || []).filter(o => grouped[o.id]?.length));
      setLoading(false);
    })();
  }, []);

  const downloadBill = async (path: string, filename: string) => {
    const { data } = await supabase.storage.from("bills").createSignedUrl(path, 300);
    if (!data?.signedUrl) return;
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" /> Dokumente
      </h1>

      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Noch keine Dokumente verfügbar.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(o => {
            const docs = billsByOrder[o.id] || [];
            return (
              <div key={o.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <div className="font-semibold text-sm">{o.beschreibung || `Auftrag vom ${o.datum}`}</div>
                  {o.datum && <div className="text-xs text-muted-foreground mt-0.5">{o.datum}</div>}
                </div>
                <div className="divide-y divide-border">
                  {docs.map(b => {
                    const Icon = iconFor(b.titel);
                    const cleanTitle = (b.titel || "Dokument").replace(" per E-Mail gesendet", "");
                    const dateStr = b.notiz || new Date(b.created_at).toLocaleDateString("de-CH");
                    return (
                      <div key={b.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{cleanTitle}</div>
                          <div className="text-xs text-muted-foreground">{dateStr}</div>
                        </div>
                        {b.betrag != null && b.betrag > 0 && (
                          <div className="text-sm font-medium text-foreground hidden sm:block">{formatCHF(b.betrag)}</div>
                        )}
                        <button
                          onClick={() => downloadBill(b.file_path!, b.filename || "dokument.pdf")}
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline border border-primary/20 px-3 py-1.5 rounded-md hover:bg-primary/5 transition-colors flex-shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" /> Herunterladen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
