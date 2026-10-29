import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Trash2, Plus, ScanLine, ChevronLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import { useServerScan } from "@/hooks/useServerScan";
import { monatLabel, monatVerschieben, aktuellerMonat } from "@/lib/umsatz";
import {
  ladeSchichten, schichtStunden, formatDauer, stundenImMonat, zuLokalInput, STEMPEL_KEY, type Schicht,
} from "@/lib/arbeitszeit";

const fmtZeit = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
const fmtDatum = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });

function piep(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch { /* Ton ist optional */ }
}

export default function ZeiterfassungPage() {
  const [schichten, setSchichten] = useState<Schicht[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [codeGeladen, setCodeGeladen] = useState(false);
  const [scan, setScan] = useState("");
  const [meldung, setMeldung] = useState<{ text: string; ok: boolean } | null>(null);
  const [monat, setMonat] = useState(aktuellerMonat());
  const [jetzt, setJetzt] = useState(Date.now());
  const [edit, setEdit] = useState<{ id: string; start: string; ende: string } | null>(null);
  const [manuell, setManuell] = useState({ start: "", ende: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const laden = useCallback(async () => {
    const seit = new Date();
    seit.setMonth(seit.getMonth() - 14);
    setSchichten(await ladeSchichten(seit));
  }, []);

  useEffect(() => {
    laden();
    supabase.from("settings").select("value").eq("key", STEMPEL_KEY).maybeSingle().then(({ data }) => {
      setCode((data as any)?.value || null);
      setCodeGeladen(true);
    });
    const t = setInterval(() => setJetzt(Date.now()), 30000);
    return () => clearInterval(t);
  }, [laden]);

  useEffect(() => { inputRef.current?.focus(); }, [codeGeladen]);

  const offen = schichten.find((s) => !s.ende_at) ?? null;

  const zeigeMeldung = (text: string, ok: boolean) => {
    setMeldung({ text, ok });
    piep(ok);
    setTimeout(() => setMeldung(null), 6000);
  };

  const stempeln = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (offen) {
        const { error } = await (supabase.from as any)("arbeitszeit").update({ ende_at: new Date().toISOString() }).eq("id", offen.id);
        if (error) throw error;
        zeigeMeldung(`Ausgestempelt um ${fmtZeit(new Date().toISOString())}. Schicht: ${formatDauer(schichtStunden(offen))}`, true);
      } else {
        const { error } = await (supabase.from as any)("arbeitszeit").insert({ start_at: new Date().toISOString() });
        if (error) throw error;
        zeigeMeldung(`Eingestempelt um ${fmtZeit(new Date().toISOString())}`, true);
      }
      await laden();
    } catch (e: any) {
      zeigeMeldung(`Fehler: ${e?.message ?? "Speichern nicht möglich"}`, false);
    } finally {
      busy.current = false;
    }
  };

  const verarbeite = async (wert: string, vomServer = false) => {
    if (!wert) return;
    if (!code) {
      const { error } = await supabase.from("settings").upsert({ key: STEMPEL_KEY, value: wert }, { onConflict: "key" });
      if (error) { zeigeMeldung("Code konnte nicht gespeichert werden", false); return; }
      setCode(wert);
      zeigeMeldung("Stempel-Code gespeichert. Ab jetzt stempelt dieser Code.", true);
      return;
    }
    // Vom Server-Scanner kommt der Stempel-Code gar nicht erst hierher: der Server stempelt selbst
    if (vomServer) return;
    if (wert !== code) { zeigeMeldung("Unbekannter Code, nichts gestempelt", false); return; }
    await stempeln();
  };

  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const wert = scan.trim();
    setScan("");
    await verarbeite(wert);
  };

  // Scanner am Server: erster Scan legt den Stempel-Code fest; Stempeln selbst macht der Server
  useServerScan((c) => { verarbeite(c, true); });

  // Der Server stempelt im Hintergrund: Anzeige live aktualisieren
  useEffect(() => {
    const ch = (supabase as any)
      .channel(`arbeitszeit-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "arbeitszeit" }, (payload: any) => {
        laden();
        if (payload?.eventType === "INSERT") zeigeMeldung(`Eingestempelt um ${fmtZeit(payload.new.start_at)}`, true);
        if (payload?.eventType === "UPDATE" && payload?.new?.ende_at && Date.now() - new Date(payload.new.ende_at).getTime() < 10000) zeigeMeldung(`Ausgestempelt um ${fmtZeit(payload.new.ende_at)}`, true);
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codeZuruecksetzen = async () => {
    if (!confirm("Stempel-Code zurücksetzen? Der nächste Scan wird der neue Code.")) return;
    await supabase.from("settings").delete().eq("key", STEMPEL_KEY);
    setCode(null);
    inputRef.current?.focus();
  };

  const speichernEdit = async () => {
    if (!edit) return;
    const start = new Date(edit.start);
    const ende = edit.ende ? new Date(edit.ende) : null;
    if (isNaN(start.getTime()) || (ende && (isNaN(ende.getTime()) || ende < start))) { toast.error("Zeiten prüfen: Ende liegt vor dem Start"); return; }
    const { error } = await (supabase.from as any)("arbeitszeit").update({ start_at: start.toISOString(), ende_at: ende ? ende.toISOString() : null }).eq("id", edit.id);
    if (error) { toast.error(error.message); return; }
    setEdit(null);
    laden();
  };

  const loeschen = async (id: string) => {
    if (!confirm("Schicht löschen?")) return;
    const { error } = await (supabase.from as any)("arbeitszeit").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    laden();
  };

  const nachtragen = async () => {
    const start = new Date(manuell.start);
    const ende = new Date(manuell.ende);
    if (isNaN(start.getTime()) || isNaN(ende.getTime()) || ende < start) { toast.error("Start und Ende prüfen"); return; }
    const { error } = await (supabase.from as any)("arbeitszeit").insert({ start_at: start.toISOString(), ende_at: ende.toISOString() });
    if (error) { toast.error(error.message); return; }
    setManuell({ start: "", ende: "" });
    laden();
  };

  const heute = useMemo(() => {
    const d = new Date(jetzt);
    return schichten.filter((s) => new Date(s.start_at).toDateString() === d.toDateString()).reduce((a, s) => a + schichtStunden(s, jetzt), 0);
  }, [schichten, jetzt]);

  const woche = useMemo(() => {
    const d = new Date(jetzt);
    const tag = (d.getDay() + 6) % 7;
    const montag = new Date(d.getFullYear(), d.getMonth(), d.getDate() - tag).getTime();
    return schichten.filter((s) => new Date(s.start_at).getTime() >= montag).reduce((a, s) => a + schichtStunden(s, jetzt), 0);
  }, [schichten, jetzt]);

  const monatStunden = stundenImMonat(schichten, monat);
  const monatSchichten = schichten
    .filter((s) => {
      const d = new Date(s.start_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monat;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const tage = new Set(monatSchichten.map((s) => new Date(s.start_at).toDateString())).size;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Zeiterfassung</h1>
      </div>

      <form onSubmit={onScan} className="rounded-xl border bg-card p-5 space-y-4">
        <div className={`rounded-lg p-5 text-center ${offen ? "bg-green-500/10 border border-green-500/40" : "bg-muted"}`}>
          {offen ? (
            <>
              <div className="flex items-center justify-center gap-2 text-lg font-semibold"><LogIn className="h-5 w-5" /> Eingestempelt seit {fmtZeit(offen.start_at)}</div>
              <div className="text-4xl font-bold mt-1">{formatDauer(schichtStunden(offen, jetzt))}</div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-lg font-semibold"><LogOut className="h-5 w-5" /> Ausgestempelt</div>
              <div className="text-muted-foreground mt-1">Heute bisher: {formatDauer(heute)}</div>
            </>
          )}
        </div>

        {meldung && (
          <div className={`rounded-md px-3 py-2 text-sm font-medium ${meldung.ok ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-destructive/15 text-destructive"}`}>
            {meldung.text}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onBlur={() => setTimeout(() => { if (document.activeElement === document.body) inputRef.current?.focus(); }, 200)}
              placeholder={code ? "Stempel-Code scannen ..." : "Jetzt einen beliebigen Barcode scannen, er wird dein Stempel-Code"}
              className="pl-9"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button type="button" variant="outline" onClick={stempeln}>{offen ? "Ausstempeln" : "Einstempeln"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {code ? (
            <>Der Scanner stempelt nur den gespeicherten Code. <button type="button" className="underline" onClick={codeZuruecksetzen}>Code ändern</button></>
          ) : (
            "Noch kein Stempel-Code gespeichert. Der erste Scan wird als Stempel-Code gespeichert, am besten ein Barcode, den du an den Scanner klebst."
          )}
          {" "}Die Seite muss offen und im Vordergrund sein, damit der Scan ankommt.
        </p>
      </form>

      <div className="grid grid-cols-3 gap-3">
        {[["Heute", heute], ["Diese Woche", woche], [monatLabel(aktuellerMonat(), "lang"), stundenImMonat(schichten, aktuellerMonat())]].map(([l, h]) => (
          <div key={l as string} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-xl font-bold mt-1">{formatDauer(h as number)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setMonat(monatVerschieben(monat, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-semibold min-w-[9rem] text-center">{monatLabel(monat, "lang")}</div>
            <Button variant="ghost" size="icon" onClick={() => setMonat(monatVerschieben(monat, 1))} disabled={monat >= aktuellerMonat()}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="text-sm text-muted-foreground text-right">
            <span className="font-semibold text-foreground">{formatDauer(monatStunden)}</span> an {tage} Tagen
            {tage > 0 && <> · Ø {formatDauer(monatStunden / tage)} pro Tag</>}
          </div>
        </div>

        <div className="divide-y">
          {monatSchichten.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Keine Einträge in diesem Monat.</div>}
          {monatSchichten.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              {edit?.id === s.id ? (
                <>
                  <Input type="datetime-local" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} className="w-52" />
                  <Input type="datetime-local" value={edit.ende} onChange={(e) => setEdit({ ...edit, ende: e.target.value })} className="w-52" />
                  <Button size="icon" variant="ghost" onClick={speichernEdit}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <div className="w-24 font-medium">{fmtDatum(s.start_at)}</div>
                  <div className="flex-1">{fmtZeit(s.start_at)} – {s.ende_at ? fmtZeit(s.ende_at) : <span className="text-green-600 font-medium">läuft</span>}</div>
                  <div className="w-28 text-right font-semibold">{formatDauer(schichtStunden(s, jetzt))}</div>
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ id: s.id, start: zuLokalInput(s.start_at), ende: s.ende_at ? zuLokalInput(s.ende_at) : "" })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => loeschen(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 p-4 border-t bg-muted/30">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Nachtragen: Start</div>
            <Input type="datetime-local" value={manuell.start} onChange={(e) => setManuell({ ...manuell, start: e.target.value })} className="w-52" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ende</div>
            <Input type="datetime-local" value={manuell.ende} onChange={(e) => setManuell({ ...manuell, ende: e.target.value })} className="w-52" />
          </div>
          <Button onClick={nachtragen} disabled={!manuell.start || !manuell.ende}><Plus className="h-4 w-4 mr-1" /> Hinzufügen</Button>
        </div>
      </div>
    </div>
  );
}
