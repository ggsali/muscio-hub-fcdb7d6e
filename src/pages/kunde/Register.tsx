import { useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const KundeRegister = () => {
  const [form, setForm] = useState({
    vorname: "", nachname: "", email: "", password: "", passwordConfirm: "",
    phone: "", strasse: "", hausnummer: "", plz: "", ort: "", land: "Schweiz",
  });
  const [agb, setAgb] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { signUp } = useCustomerAuth();

  const handleGoogle = async () => {
    if (!agb) { setError("Bitte akzeptiere die AGB und Datenschutzerklärung."); return; }
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/mein-konto` },
    });
    if (error) setError("Google-Anmeldung fehlgeschlagen.");
    setGoogleLoading(false);
  };

  const handleApple = async () => {
    if (!agb) { setError("Bitte akzeptiere die AGB und Datenschutzerklärung."); return; }
    setAppleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/mein-konto` },
    });
    if (error) setError("Apple-Anmeldung fehlgeschlagen.");
    setAppleLoading(false);
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Passwort muss mindestens 6 Zeichen lang sein."); return; }
    if (form.password !== form.passwordConfirm) { setError("Passwörter stimmen nicht überein."); return; }
    if (!agb) { setError("Bitte akzeptiere die AGB."); return; }

    setLoading(true);
    const fullName = `${form.vorname.trim()} ${form.nachname.trim()}`;

    // Direkt mit allen Profile-Daten in user_metadata signUp – Trigger handle_new_user_profile übernimmt diese.
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/anmelden`,
        data: {
          full_name: fullName,
          phone: form.phone,
          address: `${form.strasse} ${form.hausnummer}`.trim(),
          city: form.ort,
          postal_code: form.plz,
          country: form.land,
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="bg-card rounded-2xl shadow-lg p-8 w-full max-w-sm border border-border text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">E-Mail bestätigen</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Wir haben eine Bestätigungs-E-Mail an <strong>{form.email}</strong> geschickt. Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.
          </p>
          <Link to="/anmelden">
            <Button variant="outline" className="w-full">Zur Anmeldung</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 py-12">
      <div className="bg-card rounded-2xl shadow-lg p-8 w-full max-w-lg border border-border">
        <div className="text-center mb-6">
          <h1 className="font-heading text-2xl font-extrabold text-foreground">Konto erstellen</h1>
          <p className="text-muted-foreground text-sm mt-2">Erstelle dein 3DMuscio-Konto</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button type="button" variant="outline" className="gap-2" onClick={handleGoogle} disabled={googleLoading}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? "..." : "Google"}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={handleApple} disabled={appleLoading}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.55-1.32 3.08-2.53 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {appleLoading ? "..." : "Apple"}
          </Button>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">oder mit E-Mail</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Persönliche Angaben</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vorname *</Label>
                <Input className="mt-1" placeholder="Max" required value={form.vorname} onChange={set("vorname")} />
              </div>
              <div>
                <Label className="text-xs">Nachname *</Label>
                <Input className="mt-1" placeholder="Mustermann" required value={form.nachname} onChange={set("nachname")} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Adresse</p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Strasse *</Label>
                  <Input className="mt-1" placeholder="Musterstrasse" required value={form.strasse} onChange={set("strasse")} />
                </div>
                <div>
                  <Label className="text-xs">Hausnummer *</Label>
                  <Input className="mt-1" placeholder="1" required value={form.hausnummer} onChange={set("hausnummer")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Postleitzahl *</Label>
                  <Input className="mt-1" placeholder="8000" required value={form.plz} onChange={set("plz")} />
                </div>
                <div>
                  <Label className="text-xs">Ort *</Label>
                  <Input className="mt-1" placeholder="Zürich" required value={form.ort} onChange={set("ort")} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Land *</Label>
                <Input className="mt-1" placeholder="Schweiz" required value={form.land} onChange={set("land")} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Kontakt</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">E-Mail *</Label>
                <Input className="mt-1" type="email" placeholder="deine@email.ch" required value={form.email} onChange={set("email")} />
              </div>
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input className="mt-1" type="tel" placeholder="+41 79 123 45 67" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Passwort</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Passwort *</Label>
                <Input className="mt-1" type="password" placeholder="Mindestens 6 Zeichen" required value={form.password} onChange={set("password")} />
              </div>
              <div>
                <Label className="text-xs">Passwort bestätigen *</Label>
                <Input className="mt-1" type="password" placeholder="Passwort wiederholen" required value={form.passwordConfirm} onChange={set("passwordConfirm")} />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox id="agb" checked={agb} onCheckedChange={v => setAgb(!!v)} className="mt-0.5" />
            <label htmlFor="agb" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              Ich habe die{" "}
              <Link to="/agb" target="_blank" className="text-primary hover:underline font-medium">AGB</Link>{" "}
              und die{" "}
              <Link to="/datenschutz" target="_blank" className="text-primary hover:underline font-medium">Datenschutzerklärung</Link>{" "}
              gelesen und akzeptiere diese. *
            </label>
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <Button size="lg" type="submit" className="w-full" disabled={loading}>
            {loading ? "Registrieren..." : "Konto erstellen"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Bereits ein Konto?{" "}
          <Link to="/anmelden" className="text-primary hover:underline font-medium">Anmelden</Link>
        </p>
      </div>
    </div>
  );
};

export default KundeRegister;
