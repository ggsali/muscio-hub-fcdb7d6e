import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ListTodo, Pencil, Check, X, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Prio = "hoch" | "normal" | "niedrig";
type Todo = {
  id: string;
  titel: string;
  notiz: string | null;
  prioritaet: Prio;
  faellig_am: string | null;
  erledigt: boolean;
  erledigt_am: string | null;
  created_at: string;
};

const PRIO_LABEL: Record<Prio, string> = { hoch: "Hoch", normal: "Normal", niedrig: "Niedrig" };
const PRIO_ORDER: Record<Prio, number> = { hoch: 0, normal: 1, niedrig: 2 };
const PRIO_STYLE: Record<Prio, string> = {
  hoch: "bg-red-500/15 text-red-600 dark:text-red-400",
  normal: "bg-primary/10 text-primary",
  niedrig: "bg-muted text-muted-foreground",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

const VORSCHLAEGE: { titel: string; prioritaet: Prio; notiz?: string }[] = [
  { titel: "Lovable: neueste Version von GitHub übernehmen und Migrationen/Edge Functions für den Adventskalender deployen", prioritaet: "hoch", notiz: "advent-tuerchen, advent-mail, create-shop-checkout; Migrationen 20261021100000 bis 20261021140000" },
  { titel: "Täglichen Versand der Türchen-Mail (advent-mail, action daily) als Cron einrichten lassen", prioritaet: "hoch", notiz: "06:00 UTC, Header x-automation-key" },
  { titel: "Adventskalender befüllen (Vorschlag prüfen, Rabatte nach Marge anpassen) und speichern", prioritaet: "hoch" },
  { titel: "Weihnachtsmodus öffentlich testen (privates Fenster, nicht eingeloggt)", prioritaet: "normal" },
  { titel: "Testmail der Türchen-Mail an mich senden", prioritaet: "normal" },
  { titel: "Google Search Console: /weihnachtsgeschenke zur Indexierung einreichen", prioritaet: "normal" },
  { titel: "Blogartikel für Weihnachtsgeschenke schreiben", prioritaet: "niedrig" },
  { titel: "Navigationsleiste: Design entscheiden", prioritaet: "niedrig" },
  { titel: "Spardose-Generator: Passungstest drucken (Vertiefung-Offset 0,2 / 0,25 / 0,3 mm, Bajonett-Kappe)", prioritaet: "normal", notiz: "Name als Spardose, Buchstaben separat zum Einlegen, runde Drehkappe hinten. Nur Buchstaben A–Z und Ziffern, keine Sonderzeichen." },
  { titel: "Spardose-Generator: Prototyp Vorschau (Name → 3D-Körper, Schlitz, Vertiefung, Kappe)", prioritaet: "niedrig" },
  { titel: "Spardose-Generator: Preisregel, Bestellung und Produktseite", prioritaet: "niedrig" },
];

export default function TodosPage() {
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"offen" | "erledigt" | "alle">("offen");

  const [titel, setTitel] = useState("");
  const [notiz, setNotiz] = useState("");
  const [prio, setPrio] = useState<Prio>("normal");
  const [faellig, setFaellig] = useState("");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitel, setEditTitel] = useState("");
  const [editNotiz, setEditNotiz] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("admin_todos" as any).select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast({ title: "To-dos konnten nicht geladen werden", description: error.message, variant: "destructive" }); return; }
    setTodos(((data as unknown) as Todo[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!titel.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("admin_todos" as any)
      .insert({ titel: titel.trim(), notiz: notiz.trim() || null, prioritaet: prio, faellig_am: faellig || null } as any)
      .select("*").single();
    setBusy(false);
    if (error) { toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" }); return; }
    setTodos((t) => [data as unknown as Todo, ...t]);
    setTitel(""); setNotiz(""); setFaellig(""); setPrio("normal");
  };

  const toggle = async (t: Todo) => {
    const erledigt = !t.erledigt;
    const erledigt_am = erledigt ? new Date().toISOString() : null;
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, erledigt, erledigt_am } : x)));
    const { error } = await supabase.from("admin_todos" as any).update({ erledigt, erledigt_am } as any).eq("id", t.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); void load(); }
  };

  const remove = async (t: Todo) => {
    if (!window.confirm(`„${t.titel}“ löschen?`)) return;
    setTodos((ts) => ts.filter((x) => x.id !== t.id));
    const { error } = await supabase.from("admin_todos" as any).delete().eq("id", t.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); void load(); }
  };

  const saveEdit = async (t: Todo) => {
    if (!editTitel.trim()) return;
    const patch = { titel: editTitel.trim(), notiz: editNotiz.trim() || null };
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    setEditId(null);
    const { error } = await supabase.from("admin_todos" as any).update(patch as any).eq("id", t.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); void load(); }
  };

  const setPrioFor = async (t: Todo, p: Prio) => {
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, prioritaet: p } : x)));
    await supabase.from("admin_todos" as any).update({ prioritaet: p } as any).eq("id", t.id);
  };

  const addSuggestions = async () => {
    const have = new Set(todos.map((t) => t.titel));
    const rows = VORSCHLAEGE.filter((v) => !have.has(v.titel)).map((v) => ({ titel: v.titel, notiz: v.notiz ?? null, prioritaet: v.prioritaet }));
    if (!rows.length) { toast({ title: "Alle Vorschläge sind schon in der Liste" }); return; }
    const { error } = await supabase.from("admin_todos" as any).insert(rows as any);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${rows.length} Punkte eingefügt` });
    void load();
  };

  const heute = todayStr();
  const sorted = useMemo(() => {
    const list = todos.filter((t) => (filter === "alle" ? true : filter === "offen" ? !t.erledigt : t.erledigt));
    return [...list].sort((a, b) => {
      if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
      const pa = PRIO_ORDER[a.prioritaet] - PRIO_ORDER[b.prioritaet];
      if (pa !== 0 && !a.erledigt) {
        // Überfällige zuerst
        const oa = a.faellig_am && a.faellig_am < heute ? 0 : 1;
        const ob = b.faellig_am && b.faellig_am < heute ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return pa;
      }
      if (a.faellig_am && b.faellig_am && a.faellig_am !== b.faellig_am) return a.faellig_am < b.faellig_am ? -1 : 1;
      if (a.faellig_am && !b.faellig_am) return -1;
      if (!a.faellig_am && b.faellig_am) return 1;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [todos, filter, heute]);

  const offen = todos.filter((t) => !t.erledigt).length;
  const erledigt = todos.length - offen;
  const ueberfaellig = todos.filter((t) => !t.erledigt && t.faellig_am && t.faellig_am < heute).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <ListTodo className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold md:text-2xl">To-dos</h1>
          <p className="text-sm text-muted-foreground">
            {offen} offen{ueberfaellig > 0 && <span className="text-red-500">, {ueberfaellig} überfällig</span>}, {erledigt} erledigt
          </p>
        </div>
      </div>

      {/* Neues To-do */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex gap-2">
          <Input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Was muss ich noch machen?"
            className="bg-input border-border"
          />
          <Button onClick={add} disabled={busy || !titel.trim()} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" /> Hinzufügen
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)} className="h-9 rounded-md border border-border bg-input px-2 text-sm">
            <option value="hoch">Priorität hoch</option>
            <option value="normal">Priorität normal</option>
            <option value="niedrig">Priorität niedrig</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Fällig
            <Input type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} className="h-9 w-40 bg-input border-border" />
          </label>
        </div>
        <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz (optional)" rows={2} className="bg-input border-border" />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["offen", "erledigt", "alle"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={addSuggestions} className="ml-auto gap-1.5 text-muted-foreground">
          <Wand2 className="h-4 w-4" /> Offene Punkte aus dem Projekt einfügen
        </Button>
      </div>

      {/* Liste */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {filter === "offen" ? "Nichts mehr zu tun. 🎉" : "Keine Einträge."}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const overdue = !t.erledigt && t.faellig_am && t.faellig_am < heute;
            const isEdit = editId === t.id;
            return (
              <li key={t.id} className={cn("flex items-start gap-3 rounded-lg border bg-card p-3", overdue ? "border-red-500/50" : "border-border", t.erledigt && "opacity-60")}>
                <input type="checkbox" checked={t.erledigt} onChange={() => toggle(t)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]" aria-label="Erledigt" />
                <div className="min-w-0 flex-1 space-y-1">
                  {isEdit ? (
                    <div className="space-y-2">
                      <Input value={editTitel} onChange={(e) => setEditTitel(e.target.value)} className="bg-input border-border" />
                      <Textarea value={editNotiz} onChange={(e) => setEditNotiz(e.target.value)} rows={2} className="bg-input border-border" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(t)} className="gap-1"><Check className="h-4 w-4" /> Speichern</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="gap-1"><X className="h-4 w-4" /> Abbrechen</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={cn("text-sm font-medium", t.erledigt && "line-through")}>{t.titel}</p>
                      {t.notiz && <p className="whitespace-pre-line text-xs text-muted-foreground">{t.notiz}</p>}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <select
                          value={t.prioritaet}
                          onChange={(e) => setPrioFor(t, e.target.value as Prio)}
                          className={cn("rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold", PRIO_STYLE[t.prioritaet])}
                          aria-label="Priorität"
                        >
                          {(Object.keys(PRIO_LABEL) as Prio[]).map((p) => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}
                        </select>
                        {t.faellig_am && (
                          <span className={cn("text-[11px]", overdue ? "font-semibold text-red-500" : "text-muted-foreground")}>
                            {overdue ? "Überfällig: " : "Fällig: "}{fmtDate(t.faellig_am)}
                          </span>
                        )}
                        {t.erledigt && t.erledigt_am && <span className="text-[11px] text-muted-foreground">Erledigt am {new Date(t.erledigt_am).toLocaleDateString("de-CH")}</span>}
                      </div>
                    </>
                  )}
                </div>
                {!isEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(t.id); setEditTitel(t.titel); setEditNotiz(t.notiz ?? ""); }} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => remove(t)} aria-label="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
