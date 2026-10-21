import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/lib/router-compat";
import { Gift, Copy, Check, Mail, Loader2 } from "lucide-react";

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

/** Konfetti-/Schneeregen im Geschenk-Fenster (reines CSS) */
function Confetti() {
  const items = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      left: Math.round(Math.random() * 100),
      delay: Math.random() * 0.9,
      dur: 2.2 + Math.random() * 2,
      size: 5 + Math.round(Math.random() * 6),
      color: ["#ffd23f", "#ff5a5f", "#3ddc84", "#ffffff", "#7fc8ff"][i % 5],
      round: i % 3 === 0,
    })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      {items.map((c, i) => (
        <span
          key={i}
          className="adv-confetti"
          style={{
            left: `${c.left}%`, width: c.size, height: c.round ? c.size : c.size * 1.6, background: c.color,
            borderRadius: c.round ? "50%" : "2px", animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Adventskalender (Weihnachtsmodus). Inhalte kommen erst am jeweiligen Tag vom Server. */
export function AdventKalender({ fallback = null }: { fallback?: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [opening, setOpening] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [door, setDoor] = useState<(Door & { tag: number }) | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [testTag, setTestTag] = useState<number | undefined>(simTag());
  const sim = testTag;

  // E-Mail-Formular im Geschenk-Fenster
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [mailState, setMailState] = useState<"idle" | "sending" | "sent">("idle");
  const [mailError, setMailError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) return;
      const { data } = await (supabase.rpc as any)("has_role", { _user_id: uid, _role: "admin" });
      if (alive && data === true) setIsAdmin(true);
    })();
    return () => { alive = false; };
  }, []);

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
    if (opening !== null) return;
    setMsg(null);
    if (tag > heute) {
      setShake(tag);
      setTimeout(() => setShake(null), 600);
      setMsg(heute === 0 ? "Das Türchen öffnet sich ab dem 1. Dezember." : `Türchen ${tag} öffnet sich am ${tag}. Dezember.`);
      return;
    }
    setOpening(tag);
    const wait = new Promise((r) => setTimeout(r, 850));
    const [res] = await Promise.all([
      supabase.functions.invoke("advent-tuerchen", { body: { action: "open", tag, sim_tag: sim } }),
      wait,
    ]);
    const { data, error } = res as { data: any; error: any };
    if (error || !data || data.error) {
      setOpening(null);
      setMsg(data?.error || "Türchen konnte nicht geöffnet werden.");
      return;
    }
    const next = Array.from(new Set([...seen, tag]));
    setSeen(next);
    try { localStorage.setItem(seenKey(jahr), JSON.stringify(next)); } catch { /* ignore */ }
    setMailState("idle");
    setMailError(null);
    setDoor({ ...(data as Door), tag });
    setOpening(null);
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const sendMail = async () => {
    if (!door) return;
    setMailError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())) { setMailError("Bitte eine gültige E-Mail-Adresse eingeben."); return; }
    setMailState("sending");
    const { data, error } = await supabase.functions.invoke("advent-mail", {
      body: { action: "send_code", tag: door.tag, email: email.trim(), consent, sim_tag: sim },
    });
    if (error || !data || data.error) {
      setMailState("idle");
      let m = data?.error as string | undefined;
      if (!m && error && (error as any).context?.json) {
        try { m = (await (error as any).context.json())?.error; } catch { /* ignore */ }
      }
      setMailError(m || "E-Mail konnte nicht gesendet werden.");
      return;
    }
    setMailState("sent");
  };

  const codeExpired = door ? door.tag < heute : false;

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
          const isOpen = opening === tag || (!locked && seen.includes(tag));
          const empty = !tage.includes(tag);
          return (
            <div key={tag} className="adv-cell aspect-square">
              <div onClick={() => open(tag)} className={`adv-frame cursor-pointer ${isOpen ? "is-open" : ""} ${shake === tag ? "adv-shake" : ""}`}>
                {/* Innenseite hinter der Tür */}
                <div className="adv-inside" aria-hidden>
                  <span>{seen.includes(tag) && opening !== tag ? "🎁" : "✨"}</span>
                </div>
                {/* Tür */}
                <button
                  type="button"
                  aria-label={`Türchen ${tag}${locked ? " (noch geschlossen)" : isOpen ? " (geöffnet)" : ""}`}
                  className={[
                    "adv-door text-sm font-bold md:text-base",
                    locked ? "adv-door-locked" : "adv-door-ready",
                    isToday && !isOpen ? "adv-door-today" : "",
                  ].join(" ")}
                >
                  <span className="adv-num">{tag}</span>
                  <span className="adv-knob" aria-hidden />
                  {locked && <span className="absolute inset-x-0 bottom-0.5 text-[9px] leading-none opacity-70" aria-hidden>🔒</span>}
                  {!locked && empty && !isOpen && <span className="sr-only">noch leer</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 min-h-[1.25rem] text-xs text-white/80" role="status">
        {msg ?? (heute === 0
          ? "Die Türchen öffnen sich ab dem 1. Dezember."
          : `Heute offen: Türchen ${Math.min(heute, 24)}. Die Codes gelten nur am jeweiligen Tag, im Kalkulator oder Warenkorb.`)}
      </p>

      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-black/25 px-2 py-1.5 text-xs">
          <span className="font-semibold text-amber-200">Admin-Test</span>
          <label className="flex items-center gap-1.5">
            Heute ist:
            <select
              value={testTag ?? ""}
              onChange={(e) => { setMsg(null); setTestTag(e.target.value === "" ? undefined : Number(e.target.value)); }}
              className="rounded border border-white/30 bg-black/30 px-1.5 py-0.5 text-white"
            >
              <option value="">echtes Datum</option>
              <option value="0">vor dem 1.12.</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}. Dezember</option>
              ))}
            </select>
          </label>
          <span className="text-white/60">Nur für dich sichtbar. Codes und Mails gelten nur am echten Datum.</span>
        </div>
      )}

      <Dialog open={!!door} onOpenChange={(o) => !o && setDoor(null)}>
        <DialogContent className="max-w-md overflow-hidden border-amber-300/60 bg-gradient-to-b from-[#8a2329] via-[#6a1a1f] to-[#3f0d11] text-amber-50 shadow-2xl">
          <Confetti />
          <div className="pointer-events-none absolute -top-px left-0 right-0 h-2 bg-[repeating-linear-gradient(90deg,#ffd23f_0_14px,#ff5a5f_14px_28px,#3ddc84_28px_42px)]" />
          <DialogHeader className="relative pt-3 text-center sm:text-center">
            <div className="adv-gift mx-auto mb-1 text-5xl" aria-hidden>🎁</div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Türchen {door?.tag} · Frohe Weihnachten</p>
            <DialogTitle className="font-heading text-2xl font-bold text-amber-100">{door?.titel}</DialogTitle>
            {door?.text && <DialogDescription className="text-amber-50/90">{door.text}</DialogDescription>}
          </DialogHeader>

          {door?.code && (
            <div className="relative space-y-3">
              <div className="mx-auto w-full rounded-xl border-2 border-dashed border-amber-300/80 bg-black/20 px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80">Dein Geschenk-Code</p>
                <div className="mt-1 flex items-center justify-center gap-3">
                  <code className="text-xl font-extrabold tracking-wider text-amber-100">{door.code}</code>
                  <Button size="sm" variant="secondary" onClick={() => copy(door.code!)} className="gap-1.5">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Kopiert" : "Kopieren"}
                  </Button>
                </div>
              </div>
              <p className="text-center text-xs text-amber-50/80">
                {codeExpired
                  ? `Dieser Code galt nur am ${door.tag}. Dezember.`
                  : "Gilt nur heute: im Online-Kalkulator oder im Shop-Warenkorb im Feld „Gutschein-Code“ einlösen."}
              </p>

              {!codeExpired && (
                <div className="rounded-lg bg-black/20 p-3">
                  {mailState === "sent" ? (
                    <p className="flex items-center gap-2 text-sm text-amber-100">
                      <Check className="h-4 w-4 shrink-0" /> Der Code ist unterwegs in dein Postfach.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-100">
                        <Mail className="h-4 w-4" /> Code per E-Mail erhalten
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="deine@email.ch"
                          autoComplete="email"
                          className="border-amber-200/40 bg-white/95 text-foreground"
                        />
                        <Button onClick={sendMail} disabled={mailState === "sending"} className="shrink-0 bg-amber-300 text-[#5a1519] hover:bg-amber-200">
                          {mailState === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Senden"}
                        </Button>
                      </div>
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-amber-50/85">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-amber-300" />
                        <span>Ja, erinnert mich täglich per E-Mail, wenn ein neues Türchen aufgeht (jederzeit abmeldbar).</span>
                      </label>
                      {mailError && <p className="mt-2 text-xs text-red-200">{mailError}</p>}
                      <p className="mt-2 text-[10px] text-amber-50/60">Wir speichern deine Adresse für den Versand. Kein Spam.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Button asChild className="relative bg-amber-300 font-semibold text-[#5a1519] hover:bg-amber-200">
            <Link to="/kalkulator-online">🎄 Jetzt im Kalkulator einlösen</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
