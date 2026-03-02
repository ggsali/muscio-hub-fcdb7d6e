import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  name: string | null;
  beschreibung: string | null;
  datum: string | null;
  status: string | null;
  geplant_von: string | null;
  geplant_bis: string | null;
  customers: { vorname: string | null; name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  "Offen":           "bg-muted text-muted-foreground border-border",
  "In Bearbeitung":  "bg-warning/20 text-warning border-warning/40",
  "Geliefert":       "bg-info/20 text-info border-info/40",
  "Bezahlt":         "bg-success/20 text-success border-success/40",
  "Abgeschlossen":   "bg-purple/20 text-purple border-purple/40",
};

const BAR_COLORS: Record<string, string> = {
  "Offen":           "bg-muted-foreground/40",
  "In Bearbeitung":  "bg-warning/50",
  "Geliefert":       "bg-info/50",
  "Bezahlt":         "bg-success/50",
  "Abgeschlossen":   "bg-purple/50",
};

const DOT_COLORS: Record<string, string> = {
  "Offen":           "bg-muted-foreground",
  "In Bearbeitung":  "bg-warning",
  "Geliefert":       "bg-info",
  "Bezahlt":         "bg-success",
  "Abgeschlossen":   "bg-purple",
};

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember"
];
const WEEKDAYS_DE = ["Mo","Di","Mi","Do","Fr","Sa","So"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

export default function KalenderPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const daysInMonth = getDaysInMonth(year, month);
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

      // Fetch orders whose datum OR planning range overlaps this month
      const { data } = await supabase
        .from("orders")
        .select("id, name, beschreibung, datum, status, geplant_von, geplant_bis, customers(vorname, name)")
        .or(`datum.gte.${from},geplant_von.lte.${to}`)
        .order("datum", { ascending: true });

      // Filter: only those touching this month
      const filtered = ((data as Order[]) || []).filter(o => {
        const d = o.datum;
        const gv = o.geplant_von;
        const gb = o.geplant_bis;
        if (d && d >= from && d <= to) return true;
        if (gv && gb) {
          return gv <= to && gb >= from;
        }
        if (gv && !gb) return gv <= to && gv >= from;
        return false;
      });

      setOrders(filtered);
      setLoading(false);
    };
    fetchOrders();
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // For each day: orders that "cover" it (via range) or just start on it
  const getOrdersForDay = (day: number): { order: Order; type: "punkt" | "range-start" | "range-mid" | "range-end" }[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const result: { order: Order; type: "punkt" | "range-start" | "range-mid" | "range-end" }[] = [];

    orders.forEach(o => {
      const hasRange = o.geplant_von && o.geplant_bis;
      const hasSingleRange = o.geplant_von && !o.geplant_bis;

      if (hasRange) {
        const inRange = dateStr >= o.geplant_von! && dateStr <= o.geplant_bis!;
        if (!inRange) return;
        if (dateStr === o.geplant_von) result.push({ order: o, type: "range-start" });
        else if (dateStr === o.geplant_bis) result.push({ order: o, type: "range-end" });
        else result.push({ order: o, type: "range-mid" });
      } else if (hasSingleRange) {
        if (dateStr === o.geplant_von) result.push({ order: o, type: "range-start" });
      } else if (o.datum) {
        if (dateStr === o.datum) result.push({ order: o, type: "punkt" });
      }
    });

    // Also show orders only with datum (no planning range)
    orders.forEach(o => {
      if (!o.geplant_von && o.datum === dateStr) {
        if (!result.find(r => r.order.id === o.id)) {
          result.push({ order: o, type: "punkt" });
        }
      }
    });

    return result;
  };

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedOrders = selectedDay
    ? orders.filter(o => {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
        if (o.geplant_von && o.geplant_bis) return dateStr >= o.geplant_von && dateStr <= o.geplant_bis;
        if (o.geplant_von) return o.geplant_von === dateStr;
        return o.datum === dateStr;
      })
    : [];

  const legendStatuses = ["Offen", "In Bearbeitung", "Geliefert", "Bezahlt", "Abgeschlossen"];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <CalendarDays className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Kalender</h1>
            <p className="text-xs text-muted-foreground">Aufträge & Bearbeitungszeiträume</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
            {MONTHS_DE[month]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="border-border text-xs ml-1"
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(null); }}>
            Heute
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {legendStatuses.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_COLORS[s]}`} />
            {s}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-3">
          <span className="w-6 h-2 rounded bg-warning/50 inline-block" />
          Bearbeitungszeitraum
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS_DE.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[88px] border-b border-r border-border bg-muted/5" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayItems = getOrdersForDay(day);
            const isSelected = selectedDay === day;
            const todayDay = isToday(day);
            const colIndex = (firstDay + i) % 7;
            const isLastCol = colIndex === 6;

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[88px] border-b border-border p-1 cursor-pointer transition-colors relative overflow-hidden
                  ${isLastCol ? "" : "border-r"}
                  ${isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/20"}
                `}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold mb-1 ${
                  todayDay ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}>
                  {day}
                </div>

                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map(({ order: o, type }) => {
                    const barColor = BAR_COLORS[o.status || "Offen"];
                    const label = o.name || o.beschreibung || o.id.slice(0, 6).toUpperCase();
                    if (type === "range-mid") {
                      return (
                        <div key={o.id} className={`h-4 ${barColor} opacity-80`} title={label} />
                      );
                    }
                    if (type === "range-start") {
                      return (
                        <div key={o.id} className={`h-4 ${barColor} rounded-l-full pl-1.5 text-[9px] font-semibold truncate leading-4 opacity-90`} title={label}>
                          {label}
                        </div>
                      );
                    }
                    if (type === "range-end") {
                      return (
                        <div key={o.id} className={`h-4 ${barColor} rounded-r-full opacity-80`} title={label} />
                      );
                    }
                    // punkt
                    return (
                      <div key={o.id} className={`text-[10px] px-1 py-0.5 rounded border truncate font-medium leading-tight ${STATUS_COLORS[o.status || "Offen"]}`}>
                        {label}
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayItems.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay !== null && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">
            {selectedDay}. {MONTHS_DE[month]} {year}
            <span className="ml-2 text-muted-foreground font-normal">
              · {selectedOrders.length} Auftrag{selectedOrders.length !== 1 ? "träge" : ""}
            </span>
          </h3>
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Aufträge an diesem Tag.</p>
          ) : (
            <div className="space-y-2">
              {selectedOrders.map(o => {
                const cName = o.customers
                  ? [o.customers.vorname, o.customers.name].filter(Boolean).join(" ")
                  : null;
                const hasRange = o.geplant_von && o.geplant_bis;
                return (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/auftraege/${o.id}`)}
                    className="flex items-center justify-between p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[o.status || "Offen"]}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {o.name || o.beschreibung || `Auftrag ${o.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {cName && <span className="text-xs text-muted-foreground">{cName}</span>}
                          {hasRange && (
                            <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                              {new Date(o.geplant_von! + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                              {" – "}
                              {new Date(o.geplant_bis! + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ml-2 ${STATUS_COLORS[o.status || "Offen"]}`}>
                      {o.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Keine Aufträge in diesem Monat.
        </div>
      )}
    </div>
  );
}
