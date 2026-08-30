import { useEffect, useState } from "react";
import { Link, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MailX, Loader2 } from "lucide-react";

export default function NewsletterAbmeldenPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    (async () => {
      if (!email) { setState("error"); return; }
      const { data, error } = await supabase.functions.invoke("newsletter-unsubscribe", { body: { email } });
      setState(error || (data as any)?.error ? "error" : "ok");
    })();
  }, [email]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
          {state === "loading" ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <MailX className="w-5 h-5 text-primary" />}
        </div>
        {state === "loading" && <p className="text-sm text-muted-foreground">Abmeldung wird verarbeitet...</p>}
        {state === "ok" && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-3">Sie wurden vom Newsletter abgemeldet.</h1>
            <p className="text-sm text-muted-foreground mb-6">Schade, dass Sie gehen!</p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-3">Abmeldung nicht möglich</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Der Link ist ungültig. Schreiben Sie uns an{" "}
              <a href="mailto:info@3dmuscio.com" className="text-primary hover:underline">info@3dmuscio.com</a>.
            </p>
          </>
        )}
        <Button asChild variant="outline">
          <Link to="/">Zurück zur Website</Link>
        </Button>
      </div>
    </div>
  );
}
