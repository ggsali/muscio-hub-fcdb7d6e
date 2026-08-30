import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShoppingBag, ExternalLink, Save, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatCHF } from "@/lib/calc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_FLOW = ["pending", "processing", "shipped", "delivered"] as const;
type ShopStatus = (typeof STATUS_FLOW)[number] | string;

const STATUS_LABELS: Record<string, string> = {
  pending: "Offen / Bezahlt",
  paid: "Bezahlt",
  processing: "In Bearbeitung",
  shipped: "Versendet",
  delivered: "Geliefert",
  cancelled: "Storniert",
};

function statusClass(status: string) {
  const s = (status || "").toLowerCase();
  if (["paid", "delivered", "shipped"].includes(s)) return "bg-green-500/15 text-green-400 border-green-500/30";
  if (["pending", "processing"].includes(s)) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (["cancelled", "canceled", "failed"].includes(s)) return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function ShopBestellungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [notiz, setNotiz] = useState("");
  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("shop_orders")
      .select("*, shop_order_items(*, shop_products(name, slug))")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Bestellung nicht gefunden");
      setLoading(false);
      return;
    }
    setOrder(data);
    setItems((data as any).shop_order_items || []);
    setNotiz((data as any).notiz || "");
    setTracking((data as any).tracking_nr || "");

    const productIds = ((data as any).shop_order_items || [])
      .map((i: any) => i.product_id)
      .filter(Boolean);
    if (productIds.length) {
      const { data: imgs } = await supabase
        .from("shop_product_images")
        .select("product_id, storage_path, is_primary, sort_order")
        .in("product_id", productIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });
      const map: Record<string, string> = {};
      (imgs || []).forEach((im: any) => {
        if (map[im.product_id]) return;
        map[im.product_id] = supabase.storage.from("shop-products").getPublicUrl(im.storage_path).data.publicUrl;
      });
      setImages(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveNotes = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("shop_orders")
      .update({ notiz, tracking_nr: tracking } as any)
      .eq("id", id);
    setSaving(false);
    if (error) toast.error("Speichern fehlgeschlagen");
    else toast.success("Gespeichert");
  };

  const changeStatus = async (status: ShopStatus) => {
    if (!id) return;
    if (status === "shipped" && !tracking.trim()) {
      toast.error("Bitte zuerst eine Tracking-Nummer erfassen");
      return;
    }
    setStatusBusy(status);
    const { error } = await supabase
      .from("shop_orders")
      .update({ status, tracking_nr: tracking || null } as any)
      .eq("id", id);
    if (error) {
      setStatusBusy(null);
      toast.error("Status-Update fehlgeschlagen");
      return;
    }
    setOrder((o: any) => ({ ...o, status }));

    if (["processing", "shipped", "delivered"].includes(status as string)) {
      const { error: mailError } = await supabase.functions.invoke("notify-shop-order-status", {
        body: { order_id: id, status, tracking_nr: tracking || null },
      });
      if (mailError) toast.warning("Status gesetzt, E-Mail konnte nicht gesendet werden");
      else toast.success(`Status "${STATUS_LABELS[status as string] || status}" gesetzt · E-Mail versendet`);
    } else {
      toast.success("Status aktualisiert");
    }
    setStatusBusy(null);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Laden...</div>;
  if (!order) return <div className="p-6 text-sm text-muted-foreground">Bestellung nicht gefunden.</div>;

  const subtotal = Number(order.subtotal || 0);
  const shipping = Number(order.shipping || 0);
  const total = Number(order.total || 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Bestellung #{String(order.id).slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date(order.created_at).toLocaleString("de-CH")}
          </p>
        </div>
        <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", statusClass(order.status))}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {/* Status ändern */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm">Status ändern</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={order.status === s ? "default" : "outline"}
              disabled={statusBusy !== null}
              onClick={() => changeStatus(s)}
            >
              {statusBusy === s ? "..." : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tracking-Nummer (für Versand-Mail)</label>
          <Input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="z.B. 99.34.123456.78901234"
            className="mt-1 bg-input border-border"
          />
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Mail className="w-3 h-3" /> Bei „In Bearbeitung“, „Versendet“ und „Geliefert“ wird automatisch eine E-Mail an den Kunden gesendet.
        </p>
      </div>

      {/* Kundendaten */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Kunde</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{order.customer_name || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">E-Mail</p>
            <p className="font-medium break-all">{order.customer_email || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telefon</p>
            <p className="font-medium">{order.customer_phone || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lieferadresse</p>
            <p className="font-medium whitespace-pre-line">
              {[order.shipping_address, `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim(), order.shipping_country]
                .filter(Boolean)
                .join("\n") || "–"}
            </p>
          </div>
        </div>
      </div>

      {/* Produkte */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <h2 className="font-semibold text-sm p-4 pb-2">Bestellte Produkte</h2>
        <div className="divide-y divide-border/50">
          {items.map((it) => (
            <div key={it.id} className="p-4 flex items-center gap-3">
              {images[it.product_id] ? (
                <img src={images[it.product_id]} alt={it.product_name} className="w-14 h-14 rounded-md object-cover border border-border" loading="lazy" />
              ) : (
                <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{it.product_name || it.shop_products?.name}</p>
                {it.optionen && Object.keys(it.optionen).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(it.optionen as Record<string, any>)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? v?.wert ?? JSON.stringify(v) : v}`)
                      .join(" · ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{it.quantity}× {formatCHF(it.unit_price)}</p>
              </div>
              <span className="font-bold text-sm">{formatCHF(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Zwischensumme</span><span>{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Versand</span><span>{shipping > 0 ? formatCHF(shipping) : "Gratis"}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t border-border/50">
            <span>Total</span><span>{formatCHF(total)}</span>
          </div>
        </div>
      </div>

      {/* Stripe + Notizen */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Stripe Session</p>
          {order.stripe_session_id ? (
            <a
              href={`https://dashboard.stripe.com/payments?query=${order.stripe_session_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all"
            >
              {order.stripe_session_id} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">–</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Interne Notizen</label>
          <Textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={4}
            placeholder="Interne Notizen zur Bestellung..."
            className="mt-1 bg-input border-border"
          />
        </div>
        <Button size="sm" onClick={saveNotes} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? "Speichern..." : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
