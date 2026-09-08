import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import FilamentTypeForm from "@/components/filament/FilamentTypeForm";
import { loadTypes, nextSpoolNumber, formatSpoolCode, typeLabel, type FilamentType } from "@/lib/filamentLager";

export default function FilamentRollenPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [anzahl, setAnzahl] = useState(1);
  const [gewicht, setGewicht] = useState(1000);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setTypes(await loadTypes()); } catch (e: any) { toast.error("Laden fehlgeschlagen: " + e.message); }
  };
  useEffect(() => { load(); }, []);

  const filteredTypes = useMemo(() => {
    const s = typeQuery.trim().toLowerCase();
    if (!s) return types;
    return types.filter(t => [t.material, t.farbe, t.hersteller || ""].join(" ").toLowerCase().includes(s));
  }, [types, typeQuery]);

  const save = async () => {
    if (!typeId) { toast.error("Bitte eine Filamentart wählen"); return; }
    const count = Math.max(1, Math.min(500, Number(anzahl) || 0));
    setSaving(true);
    try {
      const start = await nextSpoolNumber();
      const rows = Array.from({ length: count }, (_, i) => ({
        spool_code: formatSpoolCode(start + i),
        filament_type_id: typeId,
        gewicht_g: Math.max(1, Number(gewicht) || 1000),
      }));
      const { error } = await supabase.from("filament_spools").insert(rows);
      if (error) throw error;
      const from = rows[0].spool_code;
      const to = rows[rows.length - 1].spool_code;
      toast.success(
        count === 1 ? `Rolle ${from} angelegt` : `${count} Rollen angelegt: ${from} – ${to}`
      );
      setAnzahl(1);
    } catch (e: any) {
      toast.error("Anlegen fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Rollen anlegen</h1>
        <p className="text-sm text-muted-foreground">Neue Rollen mit fortlaufendem Code erfassen</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Filamentart</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={typeQuery}
              onChange={e => setTypeQuery(e.target.value)}
              placeholder="Liste filtern…"
              className="pl-9 bg-input border-border"
            />
          </div>
          <select
            value={typeId}
            onChange={e => {
              if (e.target.value === "__new__") { setShowForm(true); return; }
              setTypeId(e.target.value);
            }}
            className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
          >
            <option value="">– bitte wählen –</option>
            {filteredTypes.map(t => (
              <option key={t.id} value={t.id}>
                {typeLabel(t)}{t.hersteller ? ` (${t.hersteller})` : ""}
              </option>
            ))}
            <option value="__new__">+ Neue Filamentart anlegen…</option>
          </select>
        </div>

        {showForm && (
          <FilamentTypeForm
            onSaved={(t) => { setTypes(prev => [...prev, t]); setTypeId(t.id); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Anzahl Rollen</Label>
            <Input type="number" min={1} value={anzahl} onChange={e => setAnzahl(parseInt(e.target.value) || 1)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Gewicht pro Rolle (g)</Label>
            <Input type="number" min={1} value={gewicht} onChange={e => setGewicht(parseInt(e.target.value) || 1000)} className="bg-input border-border" />
          </div>
        </div>

        <Button onClick={save} disabled={saving}>
          <Plus className="w-4 h-4 mr-1.5" /> {saving ? "Legt an…" : "Rollen anlegen"}
        </Button>
      </div>
    </div>
  );
}
