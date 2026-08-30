import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNoIndex } from "@/hooks/useNoIndex";

const LAENDER = ["Schweiz", "Deutschland", "Österreich", "Liechtenstein", "Frankreich", "Italien"];

const CompleteProfile = () => {
  useNoIndex();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useCustomerAuth();
  const [form, setForm] = useState({
    vorname: "", nachname: "", telefon: "",
    strasse: "", hausnummer: "", plz: "", ort: "", land: "Schweiz",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/anmelden", { replace: true }); return; }

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("vorname, nachname, strasse, plz, ort, land, phone, full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const isComplete = data?.strasse && data?.plz && data?.ort && data?.vorname && data?.nachname;
      if (isComplete) { navigate("/portal", { replace: true }); return; }

      // Prefill from existing data / metadata
      const meta: any = user.user_metadata || {};
      const fullName: string = data?.full_name || meta.full_name || meta.name || "";
      const parts = fullName.trim().split(/\s+/);
      setForm(f => ({
        ...f,
        vorname: data?.vorname || meta.given_name || parts[0] || "",
        nachname: data?.nachname || meta.family_name || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
        strasse: (data?.strasse as string) || "",
        plz: (data?.plz as string) || "",
        ort: (data?.ort as string) || "",
        land: (data?.land as string) || "Schweiz",
        telefon: (data as any)?.phone || "",
      }));
      setChecking(false);
    })();
  }, [user, authLoading, navigate]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) return;

    if (!form.vorname || !form.nachname || !form.strasse || !form.plz || !form.ort || !form.land || !form.telefon) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    if (form.land === "Schweiz" && !/^\d{4}$/.test(form.plz)) {
      toast.error("Bitte eine gültige Schweizer PLZ eingeben (4 Ziffern)");
      return;
    }

    setLoading(true);
    const fullName = `${form.vorname.trim()} ${form.nachname.trim()}`;
    const strasseFull = `${form.strasse} ${form.hausnummer}`.trim();

    const { error: upsertError } = await supabase.from("profiles").upsert({
      user_id: user.id,
      full_name: fullName,
      vorname: form.vorname,
      nachname: form.nachname,
      strasse: strasseFull,
      plz: form.plz,
      ort: form.ort,
      land: form.land,
      phone: form.telefon,
      address: strasseFull,
      city: form.ort,
      postal_code: form.plz,
      country: form.land,
    } as any, { onConflict: "user_id" });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    toast.success("Profil gespeichert");
    navigate("/portal", { replace: true });
  };

  const Req = () => <span className="text-destructive">*</span>;

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <p className="text-sm text-muted-foreground">Wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 py-12">
      <div className="bg-card rounded-2xl shadow-lg p-8 w-full max-w-lg border border-border">
        <div className="text-center mb-6">
          <h1 className="font-heading text-2xl font-extrabold text-foreground">Profil vervollständigen</h1>
          <p className="text-muted-foreground text-sm mt-2">Bitte ergänze deine Adresse für Bestellungen und Versand</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Persönliche Angaben</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vorname <Req /></Label>
                <Input className="mt-1" placeholder="Max" required value={form.vorname} onChange={set("vorname")} />
              </div>
              <div>
                <Label className="text-xs">Nachname <Req /></Label>
                <Input className="mt-1" placeholder="Mustermann" required value={form.nachname} onChange={set("nachname")} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Adresse</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <div>
                  <Label className="text-xs">Strasse <Req /></Label>
                  <Input className="mt-1" placeholder="Musterstrasse" required value={form.strasse} onChange={set("strasse")} />
                </div>
                <div className="md:w-28">
                  <Label className="text-xs">Hausnr. <Req /></Label>
                  <Input className="mt-1" placeholder="1" required value={form.hausnummer} onChange={set("hausnummer")} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">PLZ <Req /></Label>
                  <Input className="mt-1" placeholder="8000" required value={form.plz} onChange={set("plz")} />
                </div>
                <div>
                  <Label className="text-xs">Ort <Req /></Label>
                  <Input className="mt-1" placeholder="Zürich" required value={form.ort} onChange={set("ort")} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Land <Req /></Label>
                  <Select value={form.land} onValueChange={(v) => setForm(f => ({ ...f, land: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAENDER.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Telefon <Req /></Label>
                  <Input className="mt-1" type="tel" placeholder="+41 79 123 45 67" required value={form.telefon} onChange={set("telefon")} />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <Button size="lg" type="submit" className="w-full" disabled={loading}>
            {loading ? "Speichern..." : "Profil speichern"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
