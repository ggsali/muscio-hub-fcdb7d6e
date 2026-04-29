import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Box, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const [success, setSuccess] = useState("");

  // Schon eingeloggt? Direkt zur passenden Bereichsseite
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", data.session.user.id);
      if (roles?.some((r: any) => r.role === "admin")) navigate("/admin", { replace: true });
      else navigate("/portal", { replace: true });
    });
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
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      });
      if (error) setError(error.message);
      else setSuccess("Konto erstellt! Bitte E-Mail bestätigen, dann anmelden.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Website
        </Link>
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Box className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">3DMuscio</h1>
          <p className="text-muted-foreground text-sm mt-1">{mode === "login" ? "Anmelden" : "Konto erstellen"}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3 mb-4">{error}</div>}
          {success && <div className="bg-success/10 border border-success/30 text-success text-sm rounded-md p-3 mb-4">{success}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="bg-input border-border" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode === "login" ? "Anmelden" : "Registrieren"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Noch kein Konto?{" "}
                <button onClick={() => { setMode("register"); setError(""); }} className="text-primary hover:underline">Registrieren</button>
              </>
            ) : (
              <>Bereits registriert?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} className="text-primary hover:underline">Anmelden</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
