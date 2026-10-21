import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListTodo, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Prio = "hoch" | "normal" | "niedrig";
type Todo = { id: string; titel: string; prioritaet: Prio; faellig_am: string | null; erledigt: boolean; created_at: string };

const ORDER: Record<Prio, number> = { hoch: 0, normal: 1, niedrig: 2 };
const DOT: Record<Prio, string> = { hoch: "bg-red-500", normal: "bg-primary", niedrig: "bg-muted-foreground/50" };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });

/** Kompakte To-do-Übersicht fürs Dashboard: offene Einträge, schnell abhaken und ergänzen. */
export function TodosWidget() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [neu, setNeu] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_todos" as any)
      .select("id,titel,prioritaet,faellig_am,erledigt,created_at")
      .eq("erledigt", false);
    setLoaded(true);
    if (!error) setTodos(((data as unknown) as Todo[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  const heute = today();
  const sorted = [...todos].sort((a, b) => {
    const oa = a.faellig_am && a.faellig_am < heute ? 0 : 1;
    const ob = b.faellig_am && b.faellig_am < heute ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (ORDER[a.prioritaet] !== ORDER[b.prioritaet]) return ORDER[a.prioritaet] - ORDER[b.prioritaet];
    if (a.faellig_am && b.faellig_am && a.faellig_am !== b.faellig_am) return a.faellig_am < b.faellig_am ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
  const shown = sorted.slice(0, 6);
  const ueberfaellig = todos.filter((t) => t.faellig_am && t.faellig_am < heute).length;

  const done = async (t: Todo) => {
    setTodos((ts) => ts.filter((x) => x.id !== t.id));
    await supabase.from("admin_todos" as any).update({ erledigt: true, erledigt_am: new Date().toISOString() } as any).eq("id", t.id);
  };

  const add = async () => {
    const titel = neu.trim();
    if (!titel) return;
    setNeu("");
    const { data } = await supabase.from("admin_todos" as any).insert({ titel } as any).select("id,titel,prioritaet,faellig_am,erledigt,created_at").single();
    if (data) setTodos((ts) => [data as unknown as Todo, ...ts]);
  };


  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate("/admin/todos")} className="flex items-center gap-2 text-sm font-semibold hover:text-primary">
          <ListTodo className="h-4 w-4 text-primary" />
          To-dos
          <span className="text-xs font-normal text-muted-foreground">
            {todos.length} offen{ueberfaellig > 0 && <span className="text-red-500">, {ueberfaellig} überfällig</span>}
          </span>
        </button>
        <button onClick={() => navigate("/admin/todos")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
          Alle <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <Input
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Neues To-do …"
          className="h-9 bg-input border-border"
        />
        <Button size="sm" onClick={add} disabled={!neu.trim()} className="h-9 shrink-0"><Plus className="h-4 w-4" /></Button>
      </div>

      {!loaded ? (
        <p className="text-xs text-muted-foreground">Laden…</p>
      ) : shown.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Nichts mehr zu tun. 🎉</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((t) => {
            const overdue = t.faellig_am && t.faellig_am < heute;
            return (
              <li key={t.id} className="flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                <input type="checkbox" onChange={() => done(t)} className="h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]" aria-label="Erledigt" />
                <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[t.prioritaet])} title={`Priorität ${t.prioritaet}`} />
                <span className="min-w-0 flex-1 truncate text-sm">{t.titel}</span>
                {t.faellig_am && (
                  <span className={cn("shrink-0 text-[11px]", overdue ? "font-semibold text-red-500" : "text-muted-foreground")}>{fmt(t.faellig_am)}</span>
                )}
              </li>
            );
          })}
          {sorted.length > shown.length && (
            <li>
              <button onClick={() => navigate("/admin/todos")} className="px-1 text-xs text-muted-foreground hover:text-foreground">
                + {sorted.length - shown.length} weitere
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
