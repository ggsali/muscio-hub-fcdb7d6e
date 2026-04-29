import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface WebsiteKunde {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  email?: string;
  existsInCustomers?: boolean;
  customerId?: string;
}

export default function WebsiteKundenPage() {
  const [kunden, setKunden] = useState<WebsiteKunde[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadWebsiteKunden();
  }, []);

  const loadWebsiteKunden = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!profiles) { setLoading(false); return; }

    // Check which are already in customers
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, email");

    const customerEmails = new Map(existingCustomers?.map(c => [c.email, c.id]) || []);

    const enriched: WebsiteKunde[] = profiles.map((p: any) => ({
      ...p,
      existsInCustomers: p.email ? customerEmails.has(p.email) : false,
      customerId: p.email ? customerEmails.get(p.email) : undefined,
    }));

    setKunden(enriched);
    setLoading(false);
  };

  const handleImportToCustomers = async (k: WebsiteKunde) => {
    const nameParts = (k.full_name || "").split(" ");
    const vorname = nameParts.slice(0, -1).join(" ") || nameParts[0] || "";
    const name = nameParts.slice(-1)[0] || k.full_name || "Unbekannt";

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

    if (error) {
      toast.error("Fehler beim Importieren");
      return;
    }

    toast.success(`${k.full_name || "Kunde"} wurde importiert`);
    loadWebsiteKunden();
    navigate(`/admin/kunden/${data.id}`);
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Website-Registrierungen
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Kunden die sich auf der 3D Print Studio Website registriert haben
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : kunden.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-2">Noch keine Registrierungen</h3>
          <p className="text-sm text-muted-foreground">
            Sobald sich Kunden auf der Website registrieren, erscheinen sie hier automatisch.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            {kunden.length} Registrierung{kunden.length !== 1 ? "en" : ""}
            {" · "}
            {kunden.filter(k => !k.existsInCustomers).length} noch nicht importiert
          </p>
          {kunden.map(k => (
            <div
              key={k.user_id}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{k.full_name || "Unbekannt"}</span>
                  {k.existsInCustomers ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">In Kunden</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Neu</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {k.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {k.phone}
                    </span>
                  )}
                  {(k.city || k.postal_code) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[k.postal_code, k.city].filter(Boolean).join(" ")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    Registriert {formatDistanceToNow(new Date(k.created_at), { addSuffix: true, locale: de })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {k.existsInCustomers && k.customerId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/kunden/${k.customerId}`)}
                    className="gap-1.5 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Öffnen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleImportToCustomers(k)}
                    className="gap-1.5 text-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    In Kunden importieren
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
