import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2, Mail, KeyRound, XCircle, Clock } from "lucide-react";
import logo from "@/assets/logo.jpeg";

type SendStatus = {
  state: "success" | "error";
  at: number;
  message: string;
};

const RESEND_KEY = "3dm_resend_status";
const RESET_KEY = "3dm_reset_status";
const COOLDOWN_SEC = 60;

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Schweiz");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"login" | "register">(
    params.get("mode") === "register" ? "register" : "login"
  );

  const [resendStatus, setResendStatus] = useState<SendStatus | null>(null);
  const [resetStatus, setResetStatus] = useState<SendStatus | null>(null);
  const [now, setNow] = useState(Date.now());

  // Statuswerte aus localStorage laden (überleben Reload)
  useEffect(() => {
    try {
      const r = localStorage.getItem(RESEND_KEY);
      if (r) setResendStatus(JSON.parse(r));
      const p = localStorage.getItem(RESET_KEY);
      if (p) setResetStatus(JSON.parse(p));
    } catch {}
  }, []);

  // Ticker für Cooldown-Anzeige
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const persistStatus = (key: string, status: SendStatus, setter: (s: SendStatus) => void) => {
    setter(status);
    try { localStorage.setItem(key, JSON.stringify(status)); } catch {}
  };

  const cooldownLeft = (status: SendStatus | null) => {
    if (!status || status.state !== "success") return 0;
    const left = COOLDOWN_SEC - Math.floor((now - status.at) / 1000);
    return left > 0 ? left : 0;
  };

  useEffect(() => {
    const redirect = async (userId: string) => {
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", userId);
      if (roles?.some((r: any) => r.role === "admin")) navigate("/admin", { replace: true });
      else navigate("/portal", { replace: true });
    };

    // Listener FIRST so we catch SIGNED_IN events from email confirmation links
    // (also fires when the user confirms their email in another tab on the same device)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session) {
        redirect(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirect(data.session.user.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", data.user.id);
      if (roles?.some((r: any) => r.role === "admin")) navigate("/admin", { replace: true });
      else navigate("/portal", { replace: true });
    } else {
      if (!fullName.trim()) { setError("Bitte Name angeben."); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: "https://3dmuscio.com/portal",
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: country.trim(),
          },
        },
      });
      if (error) setError(error.message);
      else setSuccess("Konto erstellt! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir gerade gesendet haben.");
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Bitte zuerst deine E-Mail-Adresse eingeben."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: "https://3dmuscio.com/portal" },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSuccess("Bestätigungs-E-Mail wurde erneut gesendet. Bitte prüfe dein Postfach (auch Spam-Ordner).");
  };

  const handleForgotPassword = async () => {
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Bitte zuerst deine E-Mail-Adresse eingeben."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://3dmuscio.com/reset-password",
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSuccess("Wir haben dir eine E-Mail zum Zurücksetzen des Passworts gesendet.");
  };

  const firmenname = "3DMuscio";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Website
        </Link>

        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src={logo}
            alt={firmenname}
            className="h-16 w-16 rounded-xl object-contain mb-4 shadow-lg ring-1 ring-border"
          />
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            3D<span className="text-primary">Muscio</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3 mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-primary/10 border border-primary/30 text-foreground text-sm rounded-md p-4 mb-4 flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Vor- und Nachname *</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Max Mustermann" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+41 79 ..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Adresse</Label>
                  <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Strasse und Hausnummer" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode">PLZ</Label>
                    <Input id="postalCode" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="8000" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="city">Ort</Label>
                    <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Zürich" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Land</Label>
                  <Input id="country" value={country} onChange={e => setCountry(e.target.value)} />
                </div>
                <div className="border-t border-border pt-4" />
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail *</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort *</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "register" && <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen</p>}
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode === "login" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                Passwort vergessen?
              </button>
            </div>
          )}

          {mode === "register" && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                Bestätigungs-E-Mail erneut senden
              </button>
            </div>
          )}

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Noch kein Konto?{" "}
                <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} className="text-primary font-medium hover:underline">
                  Jetzt registrieren
                </button>
              </>
            ) : (
              <>Bereits registriert?{" "}
                <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} className="text-primary font-medium hover:underline">
                  Hier anmelden
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} {firmenname}
        </p>
      </div>
    </div>
  );
}
