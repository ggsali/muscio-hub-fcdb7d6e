import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { Lock, Gift, Copy, Check } from "lucide-react";

type Status = { jahr: number; heute: number; tage: number[] };
type Door = { titel: string; text: string | null; code: string | null };

const simTag = (): number | undefined => {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("advent");
  return v !== null && /^\d+$/.test(v) ? Number(v) : undefined;
};

const seenKey = (jahr: number) => `advent-seen-${jahr}`;
const readSeen = (jahr: number): number[] => {
  try { return JSON.parse(localStorage.getItem(seenKey(jahr)) || "[]"); } catch { return []; }
};

/** Adventskalender (Weihnachtsmodus). Inhalte kommen erst am jeweiligen Tag vom Server. */
export function AdventKalender({ fallback = null }: { fallback?: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [door, setDoor] = useState<(Door & { tag: number }) | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sim = simTag();

  useEffect(() => {
    let alive = true;
    supabase.functions.invoke("advent-tuerchen", { body: { action: "status", sim_tag: sim } }).then(({ data }) => {
      if (!alive || !data || data.error) return;
      setStatus(data as Status);
      setSeen(readSeen((data as Status).jahr));
    });
    return () => { alive = false; };
  }, [sim]);

  if (!status) return <>{fallback}</>;
  const { heute, jahr, tage } = status;

  const open = async (tag: number) => {
    setMsg(null);
    if (tag > heute) {
      setMsg(heute === 0 ? "Das Türchen öffnet sich ab dem 1. Dezember." : `Türchen ${tag} öffnet sich am ${tag}. Dezember.`);
      return;
    }
    const { data, error } = await supabase.functions.invoke("advent-tuerchen", { body: { action: "open", tag, sim_tag: sim } });
    if (error || !data || data.error) {
      setMsg(data?.error || "Türchen konnte nicht geöffnet werden.");
      return;
    }
    setDoor({ ...(data as Door), tag });
    const next = Array.from(new Set([...seen, tag]));
    setSeen(next);
    try { localStorage.setItem(seenKey(jahr), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-[#7a1f24] to-[#4d1115] p-4 md:p-5 shadow-lg text-white">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/90">Adventskalender {jahr}</p>
          <h2 className="font-heading text-xl font-bold leading-tight md:text-2xl">
            {heute === 0 ? "Ab 1. Dezember jeden Tag ein Geschenk" : "Jeden Tag ein Türchen – jeden Tag ein Geschenk"}
          </h2>
        </div>
        <Gift className="h-7 w-7 shrink-0 text-amber-200" aria-hidden />
      </div>

      <div className="grid grid-cols-6 gap-1.5 md:gap-2">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((tag) => {
          const locked = tag > heute;
          const isToday = tag === heute;
          const opened = seen.includes(tag);
          const empty = !tage.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => open(tag)}
              aria-label={`Türchen ${tag}${locked ? " (noch geschlossen)" : ""}`}
              className={[
                "relative aspect-square rounded-md border text-sm font-bold transition-transform",
                "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200",
                locked
                  ? "border-white/15 bg-white/5 text-white/45 hover:bg-white/10"
                  : opened
                    ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100 hover:scale-105"
                    : "border-amber-200/70 bg-amber-300/90 text-[#5a1519] hover:scale-105",
                isToday && !opened ? "ring-2 ring-amber-100 animate-pulse" : "",
              ].join(" ")}
            >
              {tag}
              {locked && <Lock className="absolute right-0.5 top-0.5 h-2.5 w-2.5 opacity-60" aria-hidden />}
              {!locked && opened && <Check className="absolute right-0.5 top-0.5 h-3 w-3" aria-hidden />}
              {!locked && empty && !opened && <span className="sr-only">noch leer</span>}
            </button>
          );
        })}
      </div>

      <p className="mt-3 min-h-[1.25rem] text-xs text-white/80" role="status">
        {msg ?? (heute === 0
          ? "Die Türchen öffnen sich ab dem 1. Dezember."
          : `Heute offen: Türchen ${Math.min(heute, 24)}. Den Code gibst du im Warenkorb ein.`)}
      </p>

      <Dialog open={!!door} onOpenChange={(o) => !o && setDoor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎁 Türchen {door?.tag}: {door?.titel}</DialogTitle>
            {door?.text && <DialogDescription>{door.text}</DialogDescription>}
          </DialogHeader>
          {door?.code && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/50 bg-primary/5 px-4 py-3">
                <code className="text-lg font-bold tracking-wider">{door.code}</code>
                <Button size="sm" variant="outline" onClick={() => copy(door.code!)} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Kopiert" : "Kopieren"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Im Warenkorb im Feld „Gutschein-Code“ einlösen. Gültig bis Ende Dezember.</p>
            </div>
          )}
          <Button asChild>
            <Link to="/shop">Zum Shop</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
