import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle2, XCircle, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/filamentLager";

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

export default function VersandScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingTracking, setPendingTracking] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<OrderRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<OrderRow[]>([]);

  const focus = () => inputRef.current?.focus();
  useEffect(() => {
    focus();
    const iv = setInterval(() => { if (!pendingTracking) focus(); }, 1500);
    return () => clearInterval(iv);
  }, [pendingTracking]);

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
      setPendingTracking(nr);
      setValue("");
      setQuery("");
      setCandidates([]);
    } catch (e: any) {
      setFeedback({ ok: false, text: "Fehler: " + e.message });
    } finally {
      setBusy(false);
    }
  };

  const searchOrders = async (q: string) => {
    const s = q.trim();
    if (!s) { setCandidates([]); return; }
    setSearching(true);
    try {
      const sel = "id, name, beschreibung, status, tracking_nr, lieferart, created_at, customers:customer_id(vorname, name)";
      const { data: byName } = await supabase
        .from("orders")
        .select(sel)
        .or(`name.ilike.%${s}%,beschreibung.ilike.%${s}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      const { data: byCustomer } = await supabase
        .from("orders")
        .select(sel)
        .or(`vorname.ilike.%${s}%,name.ilike.%${s}%`, { foreignTable: "customers" } as any)
        .order("created_at", { ascending: false })
        .limit(20);
      const merged = new Map<string, OrderRow>();
      for (const row of [...(byName || []), ...(byCustomer || [])] as unknown as OrderRow[]) {
        if (row.customers === null && (byCustomer || []).includes(row as any)) continue;
        merged.set(row.id, row);
      }
      setCandidates([...merged.values()].slice(0, 20));
    } catch (e: any) {
      toast.error("Suche fehlgeschlagen: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  const assign = async (order: OrderRow) => {
    if (!pendingTracking) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ tracking_nr: pendingTracking, status: "Versandt" } as any)
        .eq("id", order.id);
      if (error) throw error;

      await (supabase.from as any)("order_status_log").insert({
        order_id: order.id,
        status: "Versandt",
        notiz: `Versand-Scanner · Tracking ${pendingTracking}`,
      });

      let mailOk = true;
      try {
        const { error: mailErr } = await supabase.functions.invoke("send-email", {
          body: {
            kind: "status",
            orderId: order.id,
            statusKey: "versandt",
            trackingNr: pendingTracking,
            lieferart: order.lieferart || null,
          },
        });
        if (mailErr) mailOk = false;
      } catch {
        mailOk = false;
      }

      setFeedback({
        ok: true,
        text: `Auftrag ${auftragLabel(order)} als Versandt markiert · Tracking: ${pendingTracking} · ${mailOk ? "Mail gesendet" : "Mail fehlgeschlagen"}`,
      });
      if (mailOk) toast.success(`Versandmail an ${kundeLabel(order)} gesendet`);
      else toast.error("Versandmail konnte nicht gesendet werden");

      setPendingTracking(null);
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
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Versand scannen</h1>
        <p className="text-sm text-muted-foreground">
          Tracking-Nummer scannen, Auftrag zuordnen – Status und Versandmail laufen automatisch
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="w-4 h-4" /> Scanner bereit {busy && "· verarbeite…"}
        </div>
        <Input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => { if (!pendingTracking) setTimeout(focus, 50); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleScan(value); } }}
          placeholder="Post-Tracking-Nummer scannen oder eingeben..."
          className="h-16 text-xl md:text-2xl font-mono text-center bg-input border-border"
        />
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            feedback.ok
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {pendingTracking && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm">
            Tracking <span className="font-mono font-semibold">{pendingTracking}</span> ist noch keinem Auftrag zugeordnet.
            Auftrag suchen und auswählen:
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); searchOrders(e.target.value); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); searchOrders(query); } }}
              placeholder="Auftragsnummer / Auftragsname oder Kundenname…"
              className="pl-9 bg-input border-border"
            />
          </div>
          {searching && <p className="text-sm text-muted-foreground">Sucht…</p>}
          <div className="space-y-2">
            {candidates.map(o => (
              <button
                key={o.id}
                onClick={() => assign(o)}
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
                  <span className="text-xs text-primary shrink-0">zuordnen →</span>
                </div>
              </button>
            ))}
            {!searching && query.trim() && candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">Kein Auftrag gefunden.</p>
            )}
          </div>
          <Button variant="outline" onClick={() => { setPendingTracking(null); focus(); }}>Abbrechen</Button>
        </div>
      )}

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
