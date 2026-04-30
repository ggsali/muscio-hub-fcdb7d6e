import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.jpeg";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    // Supabase setzt die Session automatisch aus dem Recovery-Link.
    // Wir hören auf das PASSWORD_RECOVERY-Event bzw. prüfen die Session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecoverySession(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/login", { replace: true }), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Anmeldung
        </Link>

        <div className="flex flex-col items-center mb-6 text-center">
          <img src={logo} alt="3DMuscio" className="h-16 w-16 rounded-xl object-contain mb-4 shadow-lg ring-1 ring-border" />
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            3D<span className="text-primary">Muscio</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Neues Passwort festlegen</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          {success ? (
            <div className="bg-primary/10 border border-primary/30 text-foreground text-sm rounded-md p-4 flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>Passwort erfolgreich geändert! Du wirst gleich weitergeleitet…</span>
            </div>
          ) : !hasRecoverySession ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              <p className="mb-3">Dieser Link ist ungültig oder abgelaufen.</p>
              <Link to="/login" className="text-primary font-medium hover:underline">
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Neues Passwort *</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Passwort bestätigen *</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Passwort speichern
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
