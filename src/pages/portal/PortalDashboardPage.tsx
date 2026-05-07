import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Package, FileText, ArrowRight, MapPin, X } from "lucide-react";
import { formatCHF } from "@/lib/calc";
import { StatusBadge } from "@/components/StatusBadge";

export default function PortalDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState<string>("");
  const [needsAddress, setNeedsAddress] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const displayName = u.user.user_metadata?.full_name || u.user.email?.split("@")[0] || "";
      setName(displayName);

      // Profil laden – Adresse vollständig? Welcome-Mail bereits gesendet?
      const { data: profile } = await supabase
        .from("profiles")
        .select("address, postal_code, city, welcome_email_sent_at, full_name")
        .eq("user_id", u.user.id)
        .maybeSingle();

      const addressMissing =
        !profile?.address?.trim() || !profile?.postal_code?.trim() || !profile?.city?.trim();
      setNeedsAddress(addressMissing);

      // Welcome-Mail einmalig senden
      if (profile && !(profile as any).welcome_email_sent_at && u.user.email) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "welcome",
              recipientEmail: u.user.email,
              idempotencyKey: `welcome-${u.user.id}`,
              templateData: {
                name: profile.full_name || displayName,
                needsAddress: addressMissing,
              },
            },
          });
          await supabase
            .from("profiles")
            .update({ welcome_email_sent_at: new Date().toISOString() } as any)
            .eq("user_id", u.user.id);
        } catch (e) {
          console.error("Welcome email failed", e);
        }
      }

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

      {needsAddress && !bannerDismissed && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Bitte vervollständige dein Profil</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Wir benötigen noch deine Adressdaten, damit wir Bestellungen abwickeln und Rechnungen erstellen können.
            </p>
            <Link
              to="/portal/profil"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Adressdaten ergänzen <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Schliessen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
