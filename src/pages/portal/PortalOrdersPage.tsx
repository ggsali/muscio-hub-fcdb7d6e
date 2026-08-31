import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF } from "@/lib/calc";
import { Package, Download, FileText, ShoppingBag, ChevronDown, ChevronUp, Paperclip, Image as ImageIcon } from "lucide-react";
import OrderProgress from "@/components/portal/OrderProgress";

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [parts, setParts] = useState<Record<string, any[]>>({});
  const [bills, setBills] = useState<Record<string, any[]>>({});
  const [orderFiles, setOrderFiles] = useState<Record<string, any[]>>({});
  const [statusLog, setStatusLog] = useState<Record<string, any[]>>({});

  const [shopOrders, setShopOrders] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<Record<string, any[]>>({});
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"auftraege" | "shop" | "anfragen">("auftraege");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const userEmail = u.user.email!;
      const { data: cust } = await supabase
        .from("customers").select("id").eq("auth_user_id", u.user.id).maybeSingle();

      // Aufträge (interne)
      if (cust) {
        const { data: ord } = await supabase
          .from("orders").select("*").eq("customer_id", cust.id).order("datum", { ascending: false });
        setOrders(ord || []);
        if (ord?.length) {
          const ids = ord.map(o => o.id);
          const [{ data: p }, { data: b }, { data: sl }, { data: ul }] = await Promise.all([
            supabase.from("parts").select("*").in("order_id", ids),
            supabase.from("bills").select("*").in("order_id", ids),
            supabase.from("order_status_log").select("*").in("order_id", ids).order("created_at", { ascending: false }),
            supabase.from("upload_links").select("id, order_id, customer_id, title").in("order_id", ids),
          ]);
          const groupBy = (rows: any[] | null, key: string) => {
            const g: Record<string, any[]> = {};
            for (const r of rows || []) (g[r[key]] ||= []).push(r);
            return g;
          };
          setParts(groupBy(p, "order_id"));
          setBills(groupBy(b, "order_id"));
          setStatusLog(groupBy(sl, "order_id"));

          // Fetch part_files for parts in these orders
          const partIds = (p || []).map(x => x.id);
          const [{ data: pf }, { data: ulf }] = await Promise.all([
            partIds.length ? supabase.from("part_files").select("*").in("part_id", partIds) : Promise.resolve({ data: [] as any[] }),
            (ul && ul.length) ? supabase.from("upload_link_files").select("*").in("upload_link_id", ul.map(l => l.id)) : Promise.resolve({ data: [] as any[] }),
          ]);
          // Combine into per-order file list
          const filesByOrder: Record<string, any[]> = {};
          const partOrderMap: Record<string, string> = {};
          for (const part of p || []) partOrderMap[part.id] = part.order_id ?? "";
          for (const f of pf || []) {
            const oid = partOrderMap[f.part_id];
            if (!oid) continue;
            (filesByOrder[oid] ||= []).push({ ...f, source: "part", bucket: "part-files" });
          }
          const linkOrderMap: Record<string, string> = {};
          for (const l of ul || []) if (l.order_id) linkOrderMap[l.id] = l.order_id;
          for (const f of ulf || []) {
            const oid = linkOrderMap[f.upload_link_id];
            if (!oid) continue;
            (filesByOrder[oid] ||= []).push({ ...f, source: "upload-link", bucket: "project-uploads" });
          }
          setOrderFiles(filesByOrder);
        }
      }


      // Shop-Bestellungen
      const { data: so } = await supabase
        .from("shop_orders").select("*")
        .or(`user_id.eq.${u.user.id},customer_email.eq.${userEmail}`)
        .order("created_at", { ascending: false });
      setShopOrders(so || []);
      if (so?.length) {
        const { data: items } = await supabase
          .from("shop_order_items").select("*").in("order_id", so.map(o => o.id));
        const g: Record<string, any[]> = {};
        for (const it of items || []) (g[it.order_id] ||= []).push(it);
        setShopItems(g);
      }

      // Anfragen
      const inqQuery = cust
        ? supabase.from("inquiries").select("*").or(`customer_id.eq.${cust.id},email.eq.${userEmail}`)
        : supabase.from("inquiries").select("*").eq("email", userEmail);
      const { data: inq } = await inqQuery.order("created_at", { ascending: false });
      setInquiries(inq || []);

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

  const downloadFromBucket = async (bucket: string, path: string, filename: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = filename;
      a.target = "_blank";
      a.click();
    }
  };


  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>;

  const TabBtn = ({ id, label, count, icon: Icon }: any) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
      {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded ${tab === id ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>}
    </button>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="w-5 h-5 text-primary" /> Meine Bestellungen
      </h1>

      <div className="flex flex-wrap gap-2">
        <TabBtn id="auftraege" label="Aufträge" count={orders.length} icon={Package} />
        <TabBtn id="shop" label="Shop" count={shopOrders.length} icon={ShoppingBag} />
        <TabBtn id="anfragen" label="Anfragen" count={inquiries.length} icon={FileText} />
      </div>

      {tab === "auftraege" && (
        orders.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Noch keine Aufträge vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const isOpen = expanded[o.id];
              const orderParts = parts[o.id] || [];
              const orderBills = bills[o.id] || [];
              const oFiles = orderFiles[o.id] || [];
              const orderLog = statusLog[o.id] || [];

              return (
                <div key={o.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <button onClick={() => toggle(o.id)} className="w-full p-5 text-left hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{o.beschreibung || `Auftrag vom ${o.datum}`}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.datum}{o.tracking_nr && ` · Tracking: ${o.tracking_nr}`}</p>
                        {o.tracking_nr && (
                          <a
                            href={`https://www.post.ch/de/empfangen/sendungsverfolgung?name=${encodeURIComponent(o.tracking_nr)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-primary underline flex items-center gap-1 mt-1"
                          >
                            <Package className="w-3 h-3" />
                            Sendung verfolgen →
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-primary">{formatCHF(o.umsatz_total)}</div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  <div className="px-5 pb-4">
                    <OrderProgress status={o.status} source={o.source || 'manual'} lieferart={(o as any).lieferart} />
                  </div>

                  {isOpen && (
                    <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
                      {orderParts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Teile</p>
                          <div className="space-y-1.5">
                            {orderParts.map(p => (
                              <div key={p.id} className="flex items-center justify-between text-sm bg-card rounded px-3 py-2 border border-border/50">
                                <span>{p.teilname} <span className="text-muted-foreground text-xs">· {p.menge}× {p.material}</span></span>
                                <span className="font-medium">{formatCHF(p.preis_total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {orderLog.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status-Verlauf</p>
                          <div className="space-y-1.5">
                            {orderLog.map(l => (
                              <div key={l.id} className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <StatusBadge status={l.status} />
                                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("de-CH")}</span>
                                {l.notiz && <span className="text-muted-foreground">— {l.notiz}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {oFiles.length > 0 && (
                        <div className="pt-3 border-t border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3 h-3" /> Hochgeladene Dateien ({oFiles.length})
                          </p>
                          <div className="space-y-1.5">
                            {oFiles.map(f => {
                              const isImg = (f.file_type || "").startsWith("image/");
                              return (
                                <button
                                  key={`${f.source}-${f.id}`}
                                  onClick={() => downloadFromBucket(f.bucket, f.storage_path, f.filename || "datei")}
                                  className="w-full flex items-center gap-2 text-xs bg-card rounded px-3 py-2 border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-colors text-left"
                                >
                                  {isImg ? <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                  <span className="flex-1 truncate">{f.filename}</span>
                                  {f.source === "upload-link" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Upload-Link</span>}
                                  <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dokumente</p>
                        {orderBills.filter(b => b.file_path).length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Noch keine Dokumente verfügbar</p>
                        ) : (
                          <div className="space-y-1.5">
                            {orderBills.filter(b => b.file_path).map(bill => (
                              <button
                                key={bill.id}
                                onClick={() => downloadBill(bill.file_path, bill.filename || "dokument.pdf")}
                                className="flex items-center gap-2 text-xs text-primary hover:underline"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{(bill.titel || "").replace(" per E-Mail gesendet", "")}</span>
                                {bill.betrag > 0 && (
                                  <span className="text-muted-foreground">— {formatCHF(bill.betrag)}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "shop" && (
        shopOrders.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Noch keine Shop-Bestellungen.
          </div>
        ) : (
          <div className="space-y-3">
            {shopOrders.map(o => {
              const isOpen = expanded[o.id];
              const items = shopItems[o.id] || [];
              return (
                <div key={o.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <button onClick={() => toggle(o.id)} className="w-full p-5 text-left hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">Shop-Bestellung</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(o.created_at).toLocaleDateString("de-CH")} · {items.length} Artikel
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-primary">{formatCHF(o.total)}</div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-5 py-4 space-y-3 bg-muted/20">
                      <div className="space-y-1.5">
                        {items.map(it => (
                          <div key={it.id} className="flex items-center justify-between text-sm bg-card rounded px-3 py-2 border border-border/50">
                            <span>{it.product_name} <span className="text-muted-foreground text-xs">× {it.quantity}</span></span>
                            <span className="font-medium">{formatCHF(it.total)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Versand an: {o.shipping_address}, {o.shipping_postal_code} {o.shipping_city}
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                        <span className="text-muted-foreground">Versand</span>
                        <span>{formatCHF(o.shipping)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "anfragen" && (
        inquiries.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Noch keine Anfragen gesendet.
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map(i => (
              <div key={i.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{i.betreff || "Anfrage"}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{i.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(i.created_at).toLocaleString("de-CH")} · {i.quelle}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{i.nachricht}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
