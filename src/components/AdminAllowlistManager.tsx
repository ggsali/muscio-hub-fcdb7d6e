import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Entry {
  id: string;
  email: string;
  notiz: string | null;
  created_at: string;
}

export default function AdminAllowlistManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [email, setEmail] = useState("");
  const [notiz, setNotiz] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_allowlist" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setEntries((data as any) || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) { toast.error("Gültige E-Mail eingeben"); return; }
    setLoading(true);
    const { error } = await supabase.from("admin_allowlist" as any).insert({ email: e, notiz: notiz.trim() || null });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("E-Mail hinzugefügt – Nutzer wird zum Admin");
    setEmail(""); setNotiz("");
    load();
  };

  const remove = async (id: string, e: string) => {
    if (!confirm(`E-Mail ${e} entfernen? Der Admin-Zugriff wird sofort entzogen.`)) return;
    const { error } = await supabase.from("admin_allowlist" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Entfernt");
    load();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 max-w-2xl space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h2 className="font-semibold">Admin-Zugriff</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nur Konten mit einer E-Mail aus dieser Liste haben Zugriff auf das Admin-Panel.
            Beim Hinzufügen wird ein bestehender Nutzer sofort zum Admin – beim Entfernen wird der Zugriff entzogen.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
        <Input
          placeholder="email@beispiel.ch"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        <Input
          placeholder="Notiz (optional)"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
        />
        <Button onClick={add} disabled={loading}>
          <Plus className="w-4 h-4 mr-1" /> Hinzufügen
        </Button>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {entries.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">Noch keine E-Mails hinterlegt.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between p-3 gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{e.email}</div>
              {e.notiz && <div className="text-xs text-muted-foreground truncate">{e.notiz}</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(e.id, e.email)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
