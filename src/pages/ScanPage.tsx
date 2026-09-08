import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ScanLine, CheckCircle2, XCircle, Search, Package, Disc3, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/filamentLager";

// ─────────────────────────────────────────────────────────────
// Versand-Modus
// ─────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  name: string | null;
  beschreibung: string | null;
  status: string | null;
  tracking_nr: string | null;
  lieferart: string | null;
  created_at: string | null;
  customers?: { vorname: string | null; name: string | null } | null;
}

const kundeLabel = (o: OrderRow) =>
  `${o.customers?.vorname || ""} ${o.customers?.name || ""}`.trim() || "–";
const auftragLabel = (o: OrderRow) => o.name || o.beschreibung || o.id.slice(0, 8);

function VersandScanner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [scannedTracking, setScannedTracking] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<OrderRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<OrderRow[]>([]);

  const focus = () => inputRef.current?.focus();
  useEffect(() => {
    focus();
    const iv = setInterval(() => { if (!scannedTracking) focus(); }, 1500);
    return () => clearInterval(iv);
  }, [scannedTracking]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, name, beschreibung, status, tracking_nr, lieferart, created_at, customers:customer_id(vorname, name)")
      .not("tracking_nr", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);
    setRecent((data || []) as unknown as OrderRow[]);
  };
  useEffect(() => { loadRecent(); }, []);

  // Schritt 1: Tracking scannen
  const handleScan = async (raw: string) => {
    const nr = raw.trim();
    if (!nr) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data: existing } = await supabase
        .from("orders")
        .select("id, name, beschreibung, status, tracking_nr, lieferart, created_at, customers:customer_id(vorname, name)")
        .eq("tracking_nr", nr)
        .maybeSingle();
      if (existing) {
        const o = existing as unknown as OrderRow;
        setFeedback({
          ok: true,
          text: `Tracking ${nr} ist bereits Auftrag "${auftragLabel(o)}" (${kundeLabel(o)}) zugeordnet · Status: ${o.status || "–"}`,
        });
        setValue("");
        focus();
        return;
      }
      setScannedTracking(nr);
      setSelectedOrder(null);
      setValue("");
      setQuery("");
      setCandidates([]);
    } catch (e: any) {
      setFeedback({ ok: false, text: "Fehler: " + e.message });
    } finally {
      setBusy(false);
    }
  };

  // Schritt 2: Auftrag suchen
  const searchOrders = async (q: string) => {
    const s = q.trim();
    if (!s) { setCandidates([]); return; }
    setSearching(true);
    try {
      const sel = "id, name, beschreibung, status, tracking_nr, lieferart, created_at, customers:customer_id(vorname, name)";
      const { data: byName } = await supabase
        .from("orders")
        .select(sel)
        .not("status", "in", '("Abgeschlossen","Storniert")')
        .or(`name.ilike.%${s}%,beschreibung.ilike.%${s}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: kunden } = await supabase
        .from("customers")
        .select("id")
        .or(`vorname.ilike.%${s}%,name.ilike.%${s}%,firma.ilike.%${s}%`)
        .limit(20);
      const kundenIds = (kunden || []).map((k: any) => k.id);
      let byCustomer: any[] = [];
      if (kundenIds.length > 0) {
        const { data } = await supabase
          .from("orders")
          .select(sel)
          .not("status", "in", '("Abgeschlossen","Storniert")')
          .in("customer_id", kundenIds)
          .order("created_at", { ascending: false })
          .limit(20);
        byCustomer = data || [];
      }

      const merged = new Map<string, OrderRow>();
      for (const row of [...(byName || []), ...byCustomer] as unknown as OrderRow[]) {
        merged.set(row.id, row);
      }
      setCandidates([...merged.values()].slice(0, 20));
    } catch (e: any) {
      toast.error("Suche fehlgeschlagen: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  // Schritt 3: Bestätigen
  const confirm = async () => {
    if (!scannedTracking || !selectedOrder) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ tracking_nr: scannedTracking, status: "Versandt" } as any)
        .eq("id", selectedOrder.id);
      if (error) throw error;

      await (supabase.from as any)("order_status_log").insert({
        order_id: selectedOrder.id,
        status: "Versandt",
        notiz: `Scanner · Tracking ${scannedTracking}`,
      });

      let mailOk = true;
      try {
        const { error: mailErr } = await supabase.functions.invoke("send-email", {
          body: {
            kind: "status",
            orderId: selectedOrder.id,
            statusKey: "versandt",
            trackingNr: scannedTracking,
            lieferart: selectedOrder.lieferart || null,
          },
        });
        if (mailErr) mailOk = false;
      } catch {
        mailOk = false;
      }

      toast.success(`✓ Versandt! Mail gesendet an ${kundeLabel(selectedOrder)}`);
      if (!mailOk) toast.error("Versandmail konnte nicht gesendet werden");
      setFeedback({
        ok: true,
        text: `${auftragLabel(selectedOrder)} als Versandt markiert · Tracking: ${scannedTracking} · ${mailOk ? "Mail gesendet" : "Mail fehlgeschlagen"}`,
      });

      setScannedTracking(null);
      setSelectedOrder(null);
      setCandidates([]);
      setQuery("");
      await loadRecent();
      focus();
    } catch (e: any) {
      setFeedback({ ok: false, text: "Fehler: " + e.message });
      toast.error("Zuordnung fehlgeschlagen: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Schritt 1 */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="w-4 h-4" /> Scanner bereit {busy && "· verarbeite…"}
        </div>
        <Input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => { if (!scannedTracking) setTimeout(focus, 50); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleScan(value); } }}
          placeholder="Post-Tracking-Nummer scannen..."
          className="h-16 text-xl md:text-2xl font-mono text-center bg-input border-border"
        />
      </div>

      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border p-3 text-sm",
            feedback.ok
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Schritt 2 + 3 */}
      {scannedTracking && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-1.5 text-sm">
                <p>📦 Tracking: <span className="font-mono font-semibold">{scannedTracking}</span></p>
                <p>🧾 Auftrag: <span className="font-semibold">{auftragLabel(selectedOrder)}</span> – {kundeLabel(selectedOrder)}</p>
              </div>
              <Button
                onClick={confirm}
                disabled={busy}
                className="w-full h-14 text-base"
              >
                {busy ? "Verarbeite…" : "✓ Versand bestätigen & Mail senden"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedOrder(null)}
              >
                Anderen Auftrag wählen
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm">
                Tracking <span className="font-mono font-semibold">{scannedTracking}</span> ist noch keinem Auftrag zugeordnet.
                Auftrag suchen und auswählen:
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={e => { setQuery(e.target.value); searchOrders(e.target.value); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); searchOrders(query); } }}
                  placeholder="Auftrag suchen (Name, Nummer...)"
                  className="pl-9 h-12 bg-input border-border"
                />
              </div>
              {searching && <p className="text-sm text-muted-foreground">Sucht…</p>}
              <div className="space-y-2">
                {candidates.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    disabled={busy}
                    className="w-full text-left rounded-xl border border-border bg-background p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{auftragLabel(o)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {kundeLabel(o)} · {o.status || "–"}
                        </p>
                      </div>
                      <span className="text-xs text-primary shrink-0">auswählen →</span>
                    </div>
                  </button>
                ))}
                {!searching && query.trim() && candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground">Kein Auftrag gefunden.</p>
                )}
              </div>
              <Button variant="outline" onClick={() => { setScannedTracking(null); focus(); }}>Abbrechen</Button>
            </>
          )}
        </div>
      )}

      {/* Mini-Log */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium">
          <Package className="w-4 h-4 text-primary" /> Letzte versendete Aufträge
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Sendungen erfasst.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(o => (
              <li key={o.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{auftragLabel(o)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {kundeLabel(o)} · {o.created_at ? relativeTime(o.created_at) : ""}
                  </p>
                </div>
                <span className="font-mono text-xs shrink-0">{o.tracking_nr}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filament-Modus (Leer melden)
// ─────────────────────────────────────────────────────────────

type ScanResult = { ok: boolean; text: string; code: string };

function FilamentScanner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);

  const focus = () => inputRef.current?.focus();
  useEffect(() => {
    focus();
    const iv = setInterval(focus, 1500);
    return () => clearInterval(iv);
  }, []);

  const handle = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setBusy(true);
    try {
      const { data: spool, error } = await supabase
        .from("filament_spools")
        .select("id, spool_code, status, filament_type_id")
        .eq("spool_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!spool) {
        setResults(r => [{ ok: false, text: "Code unbekannt", code }, ...r].slice(0, 15));
        return;
      }
      if ((spool as any).status === "leer") {
        setResults(r => [{ ok: false, text: "Rolle war bereits leer gemeldet", code }, ...r].slice(0, 15));
        return;
      }
      const { data: typ } = await supabase
        .from("filament_types")
        .select("material, farbe")
        .eq("id", (spool as any).filament_type_id)
        .maybeSingle();
      const { error: upErr } = await supabase
        .from("filament_spools")
        .update({ status: "leer", emptied_at: new Date().toISOString() })
        .eq("id", (spool as any).id);
      if (upErr) throw upErr;
      const label = typ ? `${(typ as any).material} · ${(typ as any).farbe}` : "Rolle";
      setResults(r => [{ ok: true, text: `${label} – als leer gemeldet`, code }, ...r].slice(0, 15));
    } catch (e: any) {
      setResults(r => [{ ok: false, text: "Fehler: " + e.message, code }, ...r].slice(0, 15));
    } finally {
      setBusy(false);
      setValue("");
      focus();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="w-4 h-4" /> Scanner bereit {busy && "· verarbeite…"}
        </div>
        <Input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => setTimeout(focus, 50)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handle(value); } }}
          placeholder="FIL-0001"
          className="h-16 text-xl md:text-2xl font-mono text-center bg-input border-border"
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm",
                r.ok
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              )}
            >
              {r.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span className="font-mono">{r.code}</span>
              <span className="text-foreground/80">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Seite
// ─────────────────────────────────────────────────────────────

type Mode = "versand" | "filament";

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("versand");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">Scanner</h1>
        <p className="text-sm text-muted-foreground">Barcode-/Bluetooth-Scanner – kein Klick nötig</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode("versand")}
          className={cn(
            "rounded-2xl border-2 p-4 md:p-5 text-left transition-colors",
            mode === "versand"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <Truck className={cn("w-6 h-6 mb-2", mode === "versand" && "text-primary")} />
          <p className="font-semibold text-sm md:text-base">📦 Versand</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tracking scannen</p>
        </button>
        <button
          onClick={() => setMode("filament")}
          className={cn(
            "rounded-2xl border-2 p-4 md:p-5 text-left transition-colors",
            mode === "filament"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <Disc3 className={cn("w-6 h-6 mb-2", mode === "filament" && "text-primary")} />
          <p className="font-semibold text-sm md:text-base">🎞️ Filament</p>
          <p className="text-xs text-muted-foreground mt-0.5">Leer melden</p>
        </button>
      </div>

      {mode === "versand" ? <VersandScanner /> : <FilamentScanner />}
    </div>
  );
}
