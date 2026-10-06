import React, { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useNoIndex } from "@/hooks/useNoIndex";
import AppLayout from "./AppLayout";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

export default function AdminGate() {
  useNoIndex();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const role = useUserRole(session?.user.id);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Check MFA level whenever session or role changes
  useEffect(() => {
    if (!session || role !== "admin") return;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!data) return;
      const { currentLevel, nextLevel } = data;
      // nextLevel=aal2 means user has MFA enrolled → require it
      if (nextLevel === "aal2" && currentLevel !== "aal2") {
        setMfaRequired(true);
        setMfaVerified(false);
      } else {
        setMfaRequired(false);
        setMfaVerified(true);
      }
    });
  }, [session, role]);

  useEffect(() => {
    if (session === null) navigate("/login", { replace: true });
    else if (session && role && role !== "admin") navigate("/portal", { replace: true });
  }, [session, role, navigate]);

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setMfaLoading(true);
    setMfaError("");
    try {
      // Get active TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp) { setMfaError("Kein TOTP-Faktor gefunden. Bitte zuerst in den Einstellungen einrichten."); setMfaLoading(false); return; }

      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (!challenge) { setMfaError("Challenge fehlgeschlagen."); setMfaLoading(false); return; }

      const { error } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.id, code: totpCode.trim() });
      if (error) { setMfaError("Ungültiger Code. Bitte erneut versuchen."); setMfaLoading(false); return; }

      setMfaVerified(true);
      setMfaRequired(false);
    } catch (e: any) {
      setMfaError(e.message ?? "Fehler beim Verifizieren");
    }
    setMfaLoading(false);
  };

  // Loading spinner
  if (session === undefined || (session && role === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session || role !== "admin") return null;

  // MFA challenge screen
  if (mfaRequired && !mfaVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-xl p-8 space-y-6 shadow-lg">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">Zwei-Faktor-Authentifizierung</h1>
            <p className="text-sm text-muted-foreground">Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
          </div>
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="totp">Einmal-Code</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-xl tracking-[0.4em] font-mono"
                autoFocus
                maxLength={6}
              />
            </div>
            {mfaError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {mfaError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mfaLoading || totpCode.length < 6}>
              {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bestätigen"}
            </Button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut().then(() => navigate("/login", { replace: true }))}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
