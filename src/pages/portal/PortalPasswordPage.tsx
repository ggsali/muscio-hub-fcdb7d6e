import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

export default function PortalPasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (next !== confirm) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    setSaving(true);
    try {
      // Aktuelles Passwort prüfen via Re-Login
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Nicht angemeldet");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInErr) {
        toast.error("Aktuelles Passwort ist falsch.");
        setSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Passwort erfolgreich geändert.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Fehler beim Ändern des Passworts.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="w-5 h-5 text-primary" />
        <h1 className="font-heading text-2xl font-bold">Passwort ändern</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
        <div>
          <Label className="text-xs">Aktuelles Passwort *</Label>
          <Input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1"
            autoComplete="current-password"
          />
        </div>
        <div>
          <Label className="text-xs">Neues Passwort *</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-1"
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground mt-1">Mindestens 8 Zeichen.</p>
        </div>
        <div>
          <Label className="text-xs">Neues Passwort bestätigen *</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1"
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={saving} className="w-full gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</> : "Passwort ändern"}
        </Button>
      </form>
    </div>
  );
}
