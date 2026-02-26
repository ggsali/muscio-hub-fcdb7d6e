import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const STATUSES = ["Offen", "In Bearbeitung", "Geliefert", "Bezahlt", "Abgeschlossen"] as const;
type OrderStatus = typeof STATUSES[number];

interface LogEntry {
  id: string;
  status: string;
  notiz: string | null;
  created_at: string;
}

interface Props {
  orderId: string;
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

export default function OrderStatusWorkflow({ orderId, currentStatus, onStatusChange }: Props) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);

  const loadLog = async () => {
    const { data } = await (supabase.from as any)("order_status_log")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (data) setLog(data as unknown as LogEntry[]);
    setLoadingLog(false);
  };

  useEffect(() => {
    if (orderId) loadLog();
  }, [orderId]);

  const handleStatusClick = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    await (supabase.from as any)("order_status_log").insert({
      order_id: orderId,
      status: newStatus,
    });
    onStatusChange(newStatus);
    loadLog();
  };

  const currentIdx = STATUSES.indexOf(currentStatus as OrderStatus);

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h3 className="font-semibold text-sm">Status-Workflow</h3>

      {/* Progress Steps */}
      <div className="flex items-center gap-0">
        {STATUSES.map((s, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          const isLast = i === STATUSES.length - 1;
          return (
            <React.Fragment key={s}>
              <button
                onClick={() => handleStatusClick(s)}
                className={`flex flex-col items-center gap-1 group transition-all ${active ? "opacity-100" : done ? "opacity-80" : "opacity-40 hover:opacity-70"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${
                  active ? "bg-primary border-primary text-primary-foreground" :
                  done ? "bg-success border-success text-success-foreground" :
                  "bg-card border-border text-muted-foreground group-hover:border-primary/50"
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Clock className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>{s}</span>
              </button>
              {!isLast && (
                <div className={`flex-1 h-0.5 mb-5 mx-1 transition-all ${done ? "bg-success" : "bg-border"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Log */}
      {!loadingLog && log.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium mb-2">Verlauf</p>
          {log.slice(0, 5).map(entry => (
            <div key={entry.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums">{new Date(entry.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-foreground font-medium">{entry.status}</span>
              {entry.notiz && <span className="text-muted-foreground">· {entry.notiz}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
