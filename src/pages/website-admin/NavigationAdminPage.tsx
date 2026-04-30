import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { toast } from "sonner";

export interface NavLinkItem { label: string; path: string; }

export const DEFAULT_NAV: NavLinkItem[] = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Kalkulator", path: "/kalkulator-online" },
  { label: "Materialien", path: "/materialien" },
  { label: "Über uns", path: "/ueber-uns" },
  { label: "Kontakt", path: "/kontakt" },
];

export default function NavigationAdminPage() {
  const [items, setItems] = useState<NavLinkItem[]>(DEFAULT_NAV);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("website_settings").select("value").eq("key", "nav_links").maybeSingle()
      .then(({ data }) => {
        const v = (data as any)?.value;
        if (Array.isArray(v) && v.length) setItems(v as NavLinkItem[]);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    const valid = items.filter(i => i.label.trim() && i.path.trim());
    const { error } = await (supabase.from("website_settings") as any)
      .upsert({ key: "nav_links", value: valid, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) { toast.error(error.message); return; }
    toast.success("Navigation gespeichert");
  };

  const update = (idx: number, field: keyof NavLinkItem, value: string) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items]; const t = next[idx]; const swap = next[idx + dir];
    if (!swap) return;
    next[idx] = swap; next[idx + dir] = t;
    setItems(next);
  };
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const add = () => setItems([...items, { label: "Neu", path: "/" }]);
  const reset = () => setItems(DEFAULT_NAV);

  if (loading) return <div className="p-8">Lädt…</div>;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1">Navigation</h1>
          <p className="text-muted-foreground text-sm">Menü-Einträge in der oberen Leiste der Website.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>Auf Standard</Button>
          <Button onClick={save}><Save className="w-4 h-4 mr-1" /> Speichern</Button>
        </div>
      </div>

      <div className="space-y-2 mt-6">
        {items.map((it, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex flex-col md:flex-row gap-2 md:items-center">
            <Input className="md:max-w-[200px]" value={it.label} onChange={e => update(i, "label", e.target.value)} placeholder="Label" />
            <Input className="flex-1" value={it.path} onChange={e => update(i, "path", e.target.value)} placeholder="/pfad" />
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={add} className="w-full"><Plus className="w-4 h-4 mr-1" /> Eintrag hinzufügen</Button>
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Tipp: Pfade beginnen mit "/" für interne Seiten. Externe Links wie "https://…" werden ebenfalls unterstützt.
      </p>
    </div>
  );
}
