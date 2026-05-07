import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

type State =
  | { status: "loading" }
  | { status: "valid"; email: string }
  | { status: "already" }
  | { status: "invalid"; message: string }
  | { status: "submitting" }
  | { status: "success"; email?: string }
  | { status: "error"; message: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid", message: "Kein Token in der URL gefunden." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ status: "invalid", message: data?.error || "Ungültiger Link." });
          return;
        }
        if (data?.alreadyUnsubscribed || data?.already_unsubscribed) {
          setState({ status: "already" });
          return;
        }
        setState({ status: "valid", email: data?.email ?? "" });
      } catch (e: any) {
        setState({ status: "invalid", message: e?.message || "Fehler beim Prüfen des Links." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState({ status: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setState({ status: "success", email: (data as any)?.email });
    } catch (e: any) {
      setState({ status: "error", message: e?.message || "Abmeldung fehlgeschlagen." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-xl p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <MailX className="text-primary" />
        </div>
        <h1 className="text-xl font-bold mb-2">E-Mail abmelden</h1>

        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 className="animate-spin h-4 w-4" /> Link wird geprüft …
          </div>
        )}

        {state.status === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Möchten Sie {state.email ? <strong>{state.email}</strong> : "diese Adresse"} wirklich von zukünftigen E-Mails abmelden?
            </p>
            <Button onClick={confirm} className="w-full">Abmeldung bestätigen</Button>
          </>
        )}

        {state.status === "submitting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 className="animate-spin h-4 w-4" /> Wird verarbeitet …
          </div>
        )}

        {state.status === "success" && (
          <div className="text-sm text-muted-foreground">
            <CheckCircle2 className="text-primary h-8 w-8 mx-auto mb-2" />
            Sie wurden erfolgreich abgemeldet{state.email ? <> – <strong>{state.email}</strong></> : ""}.
          </div>
        )}

        {state.status === "already" && (
          <div className="text-sm text-muted-foreground">
            <CheckCircle2 className="text-primary h-8 w-8 mx-auto mb-2" />
            Diese Adresse ist bereits abgemeldet.
          </div>
        )}

        {(state.status === "invalid" || state.status === "error") && (
          <div className="text-sm text-destructive">
            <XCircle className="h-8 w-8 mx-auto mb-2" />
            {state.message}
          </div>
        )}
      </div>
    </div>
  );
}
