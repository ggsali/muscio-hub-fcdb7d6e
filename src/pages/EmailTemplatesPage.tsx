import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Template {
  status_key: string;
  betreff: string;
  nachricht: string;
  aktiv: boolean;
}

const LABELS: Record<string, string> = {
  datei_erhalten: "Datei erhalten",
  im_druck: "Im Druck",
  qualitaetspruefung: "Qualitätsprüfung",
  versandt: "Versandt",
  geliefert: "Geliefert",
};

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_templates").select("*");
      if (data) setTemplates(data.sort((a, b) =>
        Object.keys(LABELS).indexOf(a.status_key) - Object.keys(LABELS).indexOf(b.status_key)
      ));
      setLoading(false);
    })();
  }, []);

  const update = (key: string, field: keyof Template, value: any) =>
    setTemplates(t => t.map(x => x.status_key === key ? { ...x, [field]: value } : x));

  const save = async (t: Template) => {
    setSaving(t.status_key);
    const { error } = await supabase.from("email_templates").update({
      betreff: t.betreff, nachricht: t.nachricht, aktiv: t.aktiv,
    }).eq("status_key", t.status_key);
    setSaving(null);
    if (error) toast({ title: "Fehler", variant: "destructive" });
    else toast({ title: "Template gespeichert" });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          E-Mail Templates
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Wird automatisch versendet, wenn der Status eines Auftrags ändert.
          Verfügbare Variablen: <code>{"{{vorname}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{auftragsnummer}}"}</code>, <code>{"{{status}}"}</code>
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
      ) : templates.map(t => (
        <div key={t.status_key} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">{LABELS[t.status_key] || t.status_key}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aktiv</span>
              <Switch checked={t.aktiv} onCheckedChange={v => update(t.status_key, "aktiv", v)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Betreff</label>
            <Input
              value={t.betreff}
              onChange={e => update(t.status_key, "betreff", e.target.value)}
              className="bg-input border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nachricht</label>
            <Textarea
              value={t.nachricht}
              onChange={e => update(t.status_key, "nachricht", e.target.value)}
              className="bg-input border-border min-h-[160px] font-mono text-xs"
            />
          </div>
          <Button onClick={() => save(t)} disabled={saving === t.status_key} className="gap-2">
            <Save className="w-4 h-4" />
            {saving === t.status_key ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      ))}
    </div>
  );
}
