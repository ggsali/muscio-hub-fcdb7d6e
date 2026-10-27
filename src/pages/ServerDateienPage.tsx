import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, File as FileIcon, Folder, Home, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ServerStatusPanel from "@/components/ServerStatusPanel";

// Admin-Ansicht der Dateien auf dem Server (muscio). Nur lesen und herunterladen.
// Läuft über die Edge Function server-files, die den Slicer auf dem Server abfragt.

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server-files`;

interface Eintrag {
  name: string;
  type: "dir" | "file";
  size?: number;
  mtime?: number; // Unix-Sekunden
}

interface ListAntwort {
  path: string;
  entries: Eintrag[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    "Content-Type": "application/json",
  };
}

async function callJson<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(FUNCTION_URL, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Fehler ${res.status}`);
  return data as T;
}

function formatBytes(n?: number): string {
  if (n == null) return "";
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

function formatDatum(sekunden?: number): string {
  if (!sekunden) return "";
  return new Date(sekunden * 1000).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" });
}

export default function ServerDateienPage() {
  const [pfad, setPfad] = useState("");
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");
  const [suche, setSuche] = useState("");
  const [laedtRunter, setLaedtRunter] = useState<string | null>(null);

  const ladeOrdner = useCallback(async (p: string) => {
    setLaden(true);
    setFehler("");
    try {
      const r = await callJson<ListAntwort>({ action: "list", path: p });
      const sortiert = [...(r.entries ?? [])].sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, "de", { numeric: true });
      });
      setEintraege(sortiert);
      setPfad(p);
      setSuche("");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void ladeOrdner("");
  }, [ladeOrdner]);

  const teile = useMemo(() => pfad.split("/").filter(Boolean), [pfad]);

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return s ? eintraege.filter((e) => e.name.toLowerCase().includes(s)) : eintraege;
  }, [eintraege, suche]);

  const herunterladen = async (e: Eintrag) => {
    const voll = pfad ? `${pfad}/${e.name}` : e.name;
    setLaedtRunter(voll);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "download", path: voll }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `Fehler ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = e.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download fehlgeschlagen");
    } finally {
      setLaedtRunter(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Server</h1>
          <p className="text-sm text-muted-foreground">Auslastung und Dateien des Servers (muscio). Nur ansehen und herunterladen.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void ladeOrdner(pfad);
          }}
          disabled={laden}
        >
          {laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Aktualisieren
        </Button>
      </div>

      <ServerStatusPanel />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
            <button className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted" onClick={() => void ladeOrdner("")}>
              <Home className="h-4 w-4" />
              Server
            </button>
            {teile.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  className="rounded px-1.5 py-1 hover:bg-muted"
                  onClick={() => void ladeOrdner(teile.slice(0, i + 1).join("/"))}
                >
                  {t}
                </button>
              </span>
            ))}
          </nav>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="In diesem Ordner suchen" className="pl-8" />
          </div>
        </div>

        {fehler && (
          <div className="m-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{fehler}</div>
        )}

        {!fehler && laden && eintraege.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        )}

        {!fehler && !laden && gefiltert.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">{suche ? "Keine Treffer." : "Dieser Ordner ist leer."}</div>
        )}

        {gefiltert.length > 0 && (
          <ul className="divide-y">
            {gefiltert.map((e) => {
              const voll = pfad ? `${pfad}/${e.name}` : e.name;
              return (
                <li key={e.name} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  {e.type === "dir" ? (
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void ladeOrdner(voll)}>
                      <Folder className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{e.name}</span>
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{e.name}</span>
                    </div>
                  )}
                  <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{e.type === "file" ? formatBytes(e.size) : ""}</span>
                  <span className="hidden w-32 text-right text-xs text-muted-foreground md:block">{formatDatum(e.mtime)}</span>
                  {e.type === "file" ? (
                    <Button variant="ghost" size="icon" onClick={() => void herunterladen(e)} disabled={laedtRunter === voll} title="Herunterladen">
                      {laedtRunter === voll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <span className="w-10" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
