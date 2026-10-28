import { useEffect, useState } from "react";
import { Activity, Clock, Cpu, HardDrive, Loader2, MemoryStick, Thermometer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Live-Übersicht über die Auslastung des Servers (muscio). Live-Strom jede Sekunde (Server-Sent Events),
// mit Rückfall auf Abfrage jede Sekunde (Wache bei gepuffertem Strom). Daten kommen vom Slicer (/system/stream, /system/status) über die Edge Function server-files.

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server-files`;
const INTERVALL_MS = 1000; // Rückfall: Abfrage jede Sekunde, falls der Live-Strom nicht (rechtzeitig) ankommt
const STROM_STILLE_MS = 5000; // keine Daten im Live-Strom für so lange -> gepuffert, auf Abfrage jede Sekunde wechseln
const VERLAUF = 120; // Messpunkte (bei 1 pro Sekunde = 2 Minuten)

interface SlicerJob {
  id?: string;
  created?: number;
  status?: string;
  duration_s?: number;
}

interface Status {
  uptime_s?: number;
  cpu_percent?: number;
  cpu_count?: number;
  load?: number[];
  mem?: { total?: number; used?: number; available?: number };
  swap?: { total?: number; used?: number };
  temp_c?: number | null;
  disk?: { total?: number; used?: number; free?: number };
  slicer?: {
    running?: number;
    queued?: number;
    max_parallel?: number;
    mem_bytes?: number;
    mem_limit_bytes?: number;
    jobs_total?: number;
    last_jobs?: SlicerJob[];
  };
}

function formatBytes(n?: number): string {
  if (n == null) return "–";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDauer(s?: number): string {
  if (s == null) return "–";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
}

function prozent(teil?: number, ganz?: number): number | null {
  if (teil == null || !ganz) return null;
  return Math.max(0, Math.min(100, (teil / ganz) * 100));
}

function farbe(p: number | null): string {
  if (p == null) return "bg-muted-foreground";
  if (p >= 90) return "bg-destructive";
  if (p >= 70) return "bg-amber-500";
  return "bg-primary";
}

function Balken({ p }: { p: number | null }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full transition-all ${farbe(p)}`} style={{ width: `${p ?? 0}%` }} />
    </div>
  );
}

function Verlauf({ werte }: { werte: number[] }) {
  if (werte.length < 2) return <div className="mt-2 h-8" />;
  const w = 200;
  const h = 32;
  const pts = werte
    .map((v, i) => `${((i / (VERLAUF - 1)) * w).toFixed(1)},${(h - (Math.max(0, Math.min(100, v)) / 100) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-8 w-full text-primary" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Karte({ icon, titel, children }: { icon: React.ReactNode; titel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {titel}
      </div>
      {children}
    </div>
  );
}

export default function ServerStatusPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [fehler, setFehler] = useState("");
  const [erstLaden, setErstLaden] = useState(true);
  const [cpuVerlauf, setCpuVerlauf] = useState<number[]>([]);
  const [ramVerlauf, setRamVerlauf] = useState<number[]>([]);
  const [stand, setStand] = useState<Date | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let aktiv = true;
    let abbruch: AbortController | null = null;
    let wacheAusgeloest = false; // true, wenn die Wache den Strom wegen Stille beendet hat

    const uebernehmen = (s: Status) => {
      setErstLaden(false); // sofort anzeigen, sobald der erste Wert da ist (nicht erst nach Ende des Live-Stroms)
      setStatus(s);
      setFehler("");
      setStand(new Date());
      if (s.cpu_percent != null) setCpuVerlauf((v) => [...v, s.cpu_percent!].slice(-VERLAUF));
      const rp = prozent(s.mem?.used, s.mem?.total);
      if (rp != null) setRamVerlauf((v) => [...v, rp].slice(-VERLAUF));
    };

    const kopf = async () => {
      const { data } = await supabase.auth.getSession();
      return {
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        "Content-Type": "application/json",
      };
    };

    const warten = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    /** Einmal abfragen (Rückfall). */
    const einmal = async () => {
      const res = await fetch(FUNCTION_URL, { method: "POST", headers: await kopf(), body: JSON.stringify({ action: "status" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Fehler ${res.status}`);
      if (aktiv) uebernehmen(j as Status);
    };

    /** Live-Strom lesen, bis der Server ihn schliesst. Wirft, wenn der Strom nicht geht. */
    const strom = async () => {
      abbruch = new AbortController();
      let letzte = Date.now();
      // Wache: kommen im Strom keine Daten mehr an (Puffer in Supabase/Tunnel), Strom beenden und per Abfrage weitermachen
      const wache = window.setInterval(() => {
        if (Date.now() - letzte > STROM_STILLE_MS) {
          wacheAusgeloest = true;
          abbruch?.abort();
        }
      }, 1000);
      try {
        const res = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: await kopf(),
          body: JSON.stringify({ action: "stream" }),
          signal: abbruch.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Fehler ${res.status}`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let puffer = "";
        let gelesen = 0;
        while (aktiv) {
          const { done, value } = await reader.read();
          if (done) break;
          puffer += dec.decode(value, { stream: true });
          let ende: number;
          while ((ende = puffer.indexOf("\n\n")) >= 0) {
            const block = puffer.slice(0, ende);
            puffer = puffer.slice(ende + 2);
            const daten = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("");
            if (!daten) continue;
            try {
              uebernehmen(JSON.parse(daten) as Status);
              gelesen++;
              letzte = Date.now();
              setLive(true);
            } catch {
              /* unvollständiger Block ignorieren */
            }
          }
        }
        setLive(false);
        if (gelesen === 0) throw new Error("Live-Strom ohne Daten");
      } finally {
        window.clearInterval(wache);
      }
    };

    const schleife = async () => {
      let fallbackBis = 0;
      while (aktiv) {
        if (document.hidden) {
          abbruch?.abort();
          await warten(1000);
          continue;
        }
        try {
          if (Date.now() >= fallbackBis) {
            await strom(); // läuft ca. 2 Minuten, dann sofort neu verbinden
            continue;
          }
          const t = Date.now();
          await einmal();
          await warten(Math.max(0, INTERVALL_MS - (Date.now() - t))); // gleichmässig jede Sekunde
        } catch (e) {
          if (!aktiv) break;
          setLive(false);
          if (e instanceof DOMException && e.name === "AbortError") {
            if (wacheAusgeloest) {
              // Strom kam gepuffert an: 60 s lang jede Sekunde abfragen, dann den Strom erneut versuchen
              wacheAusgeloest = false;
              fallbackBis = Date.now() + 60_000;
              continue;
            }
            await warten(500);
            continue;
          }
          setFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
          fallbackBis = Date.now() + 30_000; // 30 s per Abfrage, dann Strom erneut versuchen
          try {
            await einmal();
          } catch {
            /* Fehler bleibt sichtbar */
          }
          await warten(INTERVALL_MS);
        } finally {
          if (aktiv) setErstLaden(false);
        }
      }
    };

    // Sofort einen ersten Wert holen, während sich der Live-Strom noch verbindet: so ist die Anzeige in ca. 0,5 s da
    void einmal().catch(() => { /* der Live-Strom meldet Fehler selbst */ });
    void schleife();
    return () => {
      aktiv = false;
      abbruch?.abort();
    };
  }, []);

  if (erstLaden) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Server-Status …
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Server-Status nicht verfügbar: {fehler || "keine Antwort"}
      </div>
    );
  }

  const ramP = prozent(status.mem?.used, status.mem?.total);
  const swapP = prozent(status.swap?.used, status.swap?.total);
  const diskP = prozent(status.disk?.used, status.disk?.total);
  const sl = status.slicer;
  const slicerRamP = prozent(sl?.mem_bytes, sl?.mem_limit_bytes);
  const cpu = status.cpu_percent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${fehler ? "bg-destructive" : "bg-green-500"}`} />
          {fehler ? `Verbindung gestört (${fehler})` : live ? "Live (jede Sekunde)" : "Live (Abfrage jede Sekunde)"}
        </span>
        {stand && <span>Stand {stand.toLocaleTimeString("de-CH")}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Karte icon={<Cpu className="h-4 w-4" />} titel="Prozessor">
          <div className="mt-1 text-2xl font-semibold">{cpu != null ? `${cpu.toFixed(0)} %` : "–"}</div>
          <div className="text-xs text-muted-foreground">
            {status.cpu_count ? `${status.cpu_count} Kerne` : ""}
            {status.load?.length ? ` · Last ${status.load.map((l) => l.toFixed(2)).join(" / ")}` : ""}
          </div>
          <Verlauf werte={cpuVerlauf} />
        </Karte>

        <Karte icon={<MemoryStick className="h-4 w-4" />} titel="Arbeitsspeicher">
          <div className="mt-1 text-2xl font-semibold">{ramP != null ? `${ramP.toFixed(0)} %` : "–"}</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(status.mem?.used)} von {formatBytes(status.mem?.total)}
            {status.swap?.total ? ` · Swap ${swapP != null ? swapP.toFixed(0) : 0} %` : ""}
          </div>
          <Verlauf werte={ramVerlauf} />
        </Karte>

        <Karte icon={<HardDrive className="h-4 w-4" />} titel="Speicherplatz">
          <div className="mt-1 text-2xl font-semibold">{diskP != null ? `${diskP.toFixed(0)} %` : "–"}</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(status.disk?.used)} von {formatBytes(status.disk?.total)} · {formatBytes(status.disk?.free)} frei
          </div>
          <Balken p={diskP} />
        </Karte>

        <Karte icon={<Clock className="h-4 w-4" />} titel="Laufzeit und Temperatur">
          <div className="mt-1 text-2xl font-semibold">{formatDauer(status.uptime_s)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5" />
            {status.temp_c != null ? `${status.temp_c.toFixed(0)} °C` : "Temperatur unbekannt"}
          </div>
          <Balken p={status.temp_c != null ? Math.min(100, (status.temp_c / 100) * 100) : null} />
        </Karte>
      </div>

      {sl && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" /> Slicer
            </div>
            <div className="text-sm">
              <span className="font-semibold">{sl.running ?? 0}</span> läuft
              {sl.max_parallel ? ` (max. ${sl.max_parallel} gleichzeitig)` : ""}
            </div>
            <div className="text-sm">
              <span className="font-semibold">{sl.queued ?? 0}</span> wartet
            </div>
            {sl.jobs_total != null && <div className="text-sm text-muted-foreground">{sl.jobs_total} Jobs gespeichert</div>}
            {sl.mem_bytes != null && (
              <div className="min-w-[180px] flex-1 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>RAM des Slicers</span>
                  <span>
                    {formatBytes(sl.mem_bytes)}
                    {sl.mem_limit_bytes ? ` von ${formatBytes(sl.mem_limit_bytes)}` : ""}
                  </span>
                </div>
                <Balken p={slicerRamP} />
              </div>
            )}
          </div>

          {sl.last_jobs && sl.last_jobs.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Letzte Jobs</th>
                    <th className="py-1 pr-3 font-medium">Gestartet</th>
                    <th className="py-1 pr-3 font-medium">Status</th>
                    <th className="py-1 font-medium">Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {sl.last_jobs.slice(0, 8).map((j, i) => (
                    <tr key={j.id ?? i} className="border-t">
                      <td className="py-1 pr-3 font-mono">{(j.id ?? "").slice(0, 8)}</td>
                      <td className="py-1 pr-3">
                        {j.created ? new Date(j.created * 1000).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" }) : "–"}
                      </td>
                      <td className="py-1 pr-3">{j.status ?? "–"}</td>
                      <td className="py-1">{j.duration_s != null ? `${j.duration_s.toFixed(1)} s` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
