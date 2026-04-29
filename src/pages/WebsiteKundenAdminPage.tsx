import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, KeyRound, RefreshCw, Trash2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export default function WebsiteKundenAdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState<AuthUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("website-customer-admin", {
      body: { action: "list" },
    });
    if (error) toast({ title: "Fehler beim Laden", variant: "destructive" });
    else setUsers(data?.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("link-website-customers", {});
    setBusy(false);
    if (error) toast({ title: "Sync fehlgeschlagen", variant: "destructive" });
    else toast({ title: "Sync erfolgreich", description: `${data.linked} verknüpft, ${data.created} angelegt` });
    load();
  };

  const handleReset = async () => {
    if (!confirmReset) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("website-customer-admin", {
      body: { action: "reset_password", email: confirmReset.email },
    });
    setBusy(false);
    setConfirmReset(null);
    if (error) toast({ title: "Fehler", variant: "destructive" });
    else toast({ title: "Passwort-Reset gesendet", description: confirmReset.email });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("website-customer-admin", {
      body: { action: "delete_user", user_id: confirmDelete.id },
    });
    setBusy(false);
    setConfirmDelete(null);
    if (error) toast({ title: "Fehler", variant: "destructive" });
    else { toast({ title: "Konto gelöscht" }); load(); }
  };

  const filtered = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Website-Kundenverwaltung
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} Konten · Login-Verlauf, Passwort zurücksetzen, Verknüpfung mit Kundendatenbank
          </p>
        </div>
        <Button onClick={handleSync} disabled={busy} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          Mit Kunden synchronisieren
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="E-Mail oder Name..."
          className="pl-9 bg-input border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Konten gefunden</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Name / E-Mail", "Bestätigt", "Registriert", "Letzter Login", "Aktionen"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.email_confirmed_at
                      ? <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5" />Ja</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertCircle className="w-3.5 h-3.5" />Nein</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: de })}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at
                      ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true, locale: de })
                      : "Nie"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setConfirmReset(u)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted inline-flex items-center gap-1"
                        title="Passwort-Reset senden"
                      >
                        <KeyRound className="w-3 h-3" /> Reset
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u)}
                        className="text-xs px-2 py-1 rounded border border-border text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                        title="Konto löschen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={!!confirmReset} onOpenChange={o => !o && setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passwort zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es wird eine E-Mail mit einem Reset-Link an <b>{confirmReset?.email}</b> gesendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={busy}>Senden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Auth-Konto von <b>{confirmDelete?.email}</b> wird unwiderruflich gelöscht.
              Der Kundeneintrag in der Datenbank bleibt bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
