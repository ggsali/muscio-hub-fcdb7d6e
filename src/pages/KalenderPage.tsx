import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  name: string | null;
  beschreibung: string | null;
  datum: string | null;
  status: string | null;
  customers: { vorname: string | null; name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  "Offen":           "bg-muted text-muted-foreground border-border",
  "In Bearbeitung":  "bg-warning/20 text-warning border-warning/40",
  "Geliefert":       "bg-info/20 text-info border-info/40",
  "Bezahlt":         "bg-success/20 text-success border-success/40",
  "Abgeschlossen":   "bg-purple/20 text-purple border-purple/40",
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
  // 0=Sun..6=Sat → convert to Mon-first (0=Mon..6=Sun)
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
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const daysInMonth = getDaysInMonth(year, month);
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

      const { data } = await supabase
        .from("orders")
        .select("id, name, beschreibung, datum, status, customers(vorname, name)")
        .gte("datum", from)
        .lte("datum", to)
        .order("datum", { ascending: true });

      setOrders((data as Order[]) || []);
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

  // Map: day → orders
  const ordersByDay: Record<number, Order[]> = {};
  orders.forEach(o => {
    if (!o.datum) return;
    const d = new Date(o.datum + "T12:00:00").getDate();
    if (!ordersByDay[d]) ordersByDay[d] = [];
    ordersByDay[d].push(o);
  });

  const selectedOrders = selectedDay ? (ordersByDay[selectedDay] || []) : [];

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Legend statuses
  const legendStatuses = ["Offen", "In Bearbeitung", "Geliefert", "Bezahlt", "Abgeschlossen"];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Calendar className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Kalender</h1>
            <p className="text-xs text-muted-foreground">Aufträge nach Datum</p>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">
            {MONTHS_DE[month]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-xs ml-2"
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(null); }}
          >
            Heute
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {legendStatuses.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_COLORS[s] || "bg-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS_DE.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-border bg-muted/5" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayOrders = ordersByDay[day] || [];
            const isSelected = selectedDay === day;
            const todayDay = isToday(day);

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[80px] border-b border-r border-border p-1.5 cursor-pointer transition-colors relative
                  ${isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/30"}
                  ${(firstDay + i + 1) % 7 === 0 ? "border-r-0" : ""}
                `}
              >
                {/* Day number */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold mb-1 ${
                  todayDay
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}>
                  {day}
                </div>

                {/* Order dots / pills */}
                <div className="space-y-0.5">
                  {dayOrders.slice(0, 3).map(o => (
                    <div
                      key={o.id}
                      className={`text-[10px] px-1 py-0.5 rounded border truncate font-medium leading-tight ${STATUS_COLORS[o.status || "Offen"]}`}
                    >
                      {o.name || o.beschreibung || o.id.slice(0, 6).toUpperCase()}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayOrders.length - 3} weitere</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
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
                return (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/auftraege/${o.id}`)}
                    className="flex items-center justify-between p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[o.status || "Offen"]}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {o.name || o.beschreibung || `Auftrag ${o.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        {cName && <p className="text-xs text-muted-foreground">{cName}</p>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[o.status || "Offen"]}`}>
                      {o.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary row */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {legendStatuses.map(s => {
            const count = orders.filter(o => o.status === s).length;
            if (count === 0) return null;
            return (
              <div key={s} className={`border rounded-lg px-3 py-2 text-center ${STATUS_COLORS[s]}`}>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-[10px]">{s}</div>
              </div>
            );
          })}
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
