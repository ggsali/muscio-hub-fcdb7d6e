import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-customer-profile`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "invalid" | "expired" | "used" | "error"; message?: string }
  | { kind: "ready"; customer: any; isNew: boolean }
  | { kind: "done"; isNew: boolean };

export default function ProfilErgaenzenPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState({ kind: "invalid" }); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const data = await res.json();
        if (!res.ok) {
          const kind = data?.error === "used" ? "used"
            : data?.error === "expired" ? "expired"
            : "invalid";
          setState({ kind });
          return;
        }
        const c = data.customer || {};
        const isNew = !!data.new_customer;
        setState({ kind: "ready", customer: c, isNew });
        setForm({
          vorname: c.vorname || "",
          name: c.name || "",
          firma: c.firma || "",
          email: c.email || "",
          telefon: c.telefon || "",
          strasse: c.strasse || "",
          hausnummer: c.hausnummer || "",
          plz: c.plz || "",
          ort: c.ort || "",
          land: c.land || "Schweiz",
        });
      } catch (e: any) {
        setState({ kind: "error", message: String(e) });
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = state.kind === "ready" ? state.isNew : false;
    if (!form.vorname?.trim() || !form.name?.trim() || !form.strasse?.trim() || !form.plz?.trim() || !form.ort?.trim()) {
      toast.error("Bitte fülle alle Pflichtfelder aus.");
      return;
    }
    if (isNew && (!form.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) {
      toast.error("Bitte eine gültige E-Mail-Adresse angeben.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Fehler beim Speichern");
        return;
      }
      setState({ kind: "done", isNew });
    } catch (e: any) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">
            {state.kind === "ready" && state.isNew ? "Daten ergänzen" : "Profil vervollständigen"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {state.kind === "ready" && state.isNew
              ? "Bitte fülle das Formular aus – wir legen damit dein Kundenprofil an."
              : "Bitte ergänze deine Adressdaten – sie werden direkt in deinem Kundenprofil gespeichert."}
          </p>
        </div>

        {state.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {(state.kind === "invalid" || state.kind === "expired" || state.kind === "used" || state.kind === "error") && (
          <div className="text-center py-8 space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-medium">
              {state.kind === "used" ? "Dieser Link wurde bereits verwendet."
                : state.kind === "expired" ? "Dieser Link ist abgelaufen."
                : "Dieser Link ist ungültig."}
            </p>
            <p className="text-sm text-muted-foreground">
              Bitte kontaktiere uns unter <a className="text-primary underline" href="mailto:info@3dmuscio.com">info@3dmuscio.com</a>.
            </p>
          </div>
        )}

        {state.kind === "done" && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="font-medium">Vielen Dank!</p>
            <p className="text-sm text-muted-foreground">Deine Daten wurden gespeichert.</p>
          </div>
        )}

        {state.kind === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Vorname *</Label>
                <Input className="mt-1" value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} required />
              </div>
              <div>
                <Label>Nachname *</Label>
                <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Firma (optional)</Label>
              <Input className="mt-1" value={form.firma} onChange={e => setForm({ ...form, firma: e.target.value })} />
            </div>
            {state.isNew && (
              <div>
                <Label>E-Mail *</Label>
                <Input type="email" className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="name@example.com" />
              </div>
            )}
            <div>
              <Label>Telefon</Label>
              <Input className="mt-1" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="+41 79..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Strasse *</Label>
                <Input className="mt-1" value={form.strasse} onChange={e => setForm({ ...form, strasse: e.target.value })} required />
              </div>
              <div>
                <Label>Nr.</Label>
                <Input className="mt-1" value={form.hausnummer} onChange={e => setForm({ ...form, hausnummer: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PLZ *</Label>
                <Input className="mt-1" value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <Label>Ort *</Label>
                <Input className="mt-1" value={form.ort} onChange={e => setForm({ ...form, ort: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Land</Label>
              <Input className="mt-1" value={form.land} onChange={e => setForm({ ...form, land: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Speichern...</> : "Daten speichern"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
