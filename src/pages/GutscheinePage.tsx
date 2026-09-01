import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Ticket, Plus, Copy, Mail, Trash2, MoreVertical, RefreshCw, Loader2, Search,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sendGutscheinMail } from "@/lib/gutschein.functions";
import {
  generateGutscheinCode, gutscheinWertLabel, TYP_LABELS,
  type Gutschein, type GutscheinTyp,
} from "@/lib/gutschein";


interface Kunde { id: string; name: string; vorname: string | null; email: string | null }

const CHF = (n: number) => `CHF ${n.toFixed(2)}`;

const emptyForm = () => ({
  code: generateGutscheinCode(),
  typ: "prozent" as GutscheinTyp,
  wert: "10",
  mindestbestellwert: "0",
  max_verwendungen: "1",
  gueltig_ab: new Date().toISOString().slice(0, 10),
  gueltig_bis: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
  kunde_id: "",
  grund: "",
  notiz: "",
  aktiv: true,
});

export default function GutscheinePage() {
  const [gutscheine, setGutscheine] = useState<Gutschein[]>([]);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [verwendungen, setVerwendungen] = useState<Array<{ gutschein_id: string; rabatt_betrag: number; verwendet_am: string; order_id: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mailFor, setMailFor] = useState<Gutschein | null>(null);
  const [mailTo, setMailTo] = useState("");
  const [mailName, setMailName] = useState("");
  const [mailText, setMailText] = useState("");
  const [sending, setSending] = useState(false);
  const sendGutscheinMailFn = useServerFn(sendGutscheinMail);


  const load = async () => {
    setLoading(true);
    const [g, k, v] = await Promise.all([
      supabase.from("gutscheine").select("*").order("erstellt_am", { ascending: false }),
      supabase.from("customers").select("id, name, vorname, email").order("name"),
      supabase.from("gutschein_verwendungen").select("gutschein_id, rabatt_betrag, verwendet_am, order_id").order("verwendet_am", { ascending: false }),
    ]);
    if (g.error) toast.error("Gutscheine konnten nicht geladen werden.");
    setGutscheine((g.data as unknown as Gutschein[]) || []);
    setKunden((k.data as unknown as Kunde[]) || []);
    setVerwendungen((v.data as unknown as Array<{ gutschein_id: string; rabatt_betrag: number; verwendet_am: string; order_id: string | null }>) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const heute = new Date().toISOString().slice(0, 10);
    const aktiv = gutscheine.filter(
      (g) => g.aktiv && (!g.gueltig_bis || g.gueltig_bis >= heute) &&
        (g.max_verwendungen === null || (g.verwendungen ?? 0) < (g.max_verwendungen ?? 0)),
    ).length;
    const eingeloest = verwendungen.length;
    const rabattTotal = verwendungen.reduce((s, v) => s + Number(v.rabatt_betrag || 0), 0);
    return { total: gutscheine.length, aktiv, eingeloest, rabattTotal };
  }, [gutscheine, verwendungen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gutscheine;
    return gutscheine.filter(
      (g) => g.code.toLowerCase().includes(q) || (g.grund || "").toLowerCase().includes(q),
    );
  }, [gutscheine, search]);

  const statusOf = (g: Gutschein) => {
    const heute = new Date().toISOString().slice(0, 10);
    if (!g.aktiv) return { label: "Inaktiv", variant: "secondary" as const };
    if (g.gueltig_bis && g.gueltig_bis < heute) return { label: "Abgelaufen", variant: "destructive" as const };
    if (g.max_verwendungen !== null && (g.verwendungen ?? 0) >= (g.max_verwendungen ?? 0)) {
      return { label: "Aufgebraucht", variant: "secondary" as const };
    }
    return { label: "Aktiv", variant: "default" as const };
  };

  const handleSave = async () => {
    const wert = Number(form.wert);
    if (!form.code.trim()) return toast.error("Code fehlt.");
    if (form.typ !== "gratis_versand" && (!wert || wert <= 0)) return toast.error("Wert muss grösser als 0 sein.");
    setSaving(true);
    const { error } = await supabase.from("gutscheine").insert({
      code: form.code.trim().toUpperCase(),
      typ: form.typ,
      wert: form.typ === "gratis_versand" ? 0 : wert,
      mindestbestellwert: Number(form.mindestbestellwert) || 0,
      max_verwendungen: form.max_verwendungen === "" ? null : Number(form.max_verwendungen),
      gueltig_ab: form.gueltig_ab || null,
      gueltig_bis: form.gueltig_bis || null,
      kunde_id: form.kunde_id || null,
      grund: form.grund || null,
      notiz: form.notiz || null,
      aktiv: form.aktiv,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Dieser Code existiert schon." : "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Gutschein erstellt.");
    setDialogOpen(false);
    setForm(emptyForm());
    void load();
  };

  const toggleAktiv = async (g: Gutschein) => {
    const { error } = await supabase.from("gutscheine").update({ aktiv: !g.aktiv } as never).eq("id", g.id);
    if (error) return toast.error("Aktualisieren fehlgeschlagen.");
    setGutscheine((prev) => prev.map((x) => (x.id === g.id ? { ...x, aktiv: !g.aktiv } : x)));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("gutscheine").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error("Löschen fehlgeschlagen.");
    toast.success("Gutschein gelöscht.");
    void load();
  };

  const openMail = (g: Gutschein) => {
    const kunde = kunden.find((k) => k.id === g.kunde_id);
    setMailFor(g);
    setMailTo(kunde?.email || "");
    setMailName([kunde?.vorname, kunde?.name].filter(Boolean).join(" "));
    setMailText("");
  };

  const sendMail = async () => {
    if (!mailFor || !mailTo.trim()) return toast.error("E-Mail-Adresse fehlt.");
    setSending(true);
    try {
      await sendGutscheinMailFn({
        data: {
          code: mailFor.code,
          typ: mailFor.typ,
          wert: Number(mailFor.wert),
          mindestbestellwert: mailFor.mindestbestellwert === null ? null : Number(mailFor.mindestbestellwert),
          gueltig_bis: mailFor.gueltig_bis,
          recipientEmail: mailTo.trim(),
          recipientName: mailName.trim() || null,
          message: mailText.trim() || null,
        },
      });
      toast.success(`Gutschein an ${mailTo} gesendet.`);
      setMailFor(null);
    } catch (err) {
      console.error(err);
      toast.error("E-Mail konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  };


  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} kopiert.`);
    } catch { toast.error("Kopieren nicht möglich."); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" /> Gutscheine
          </h1>
          <p className="text-sm text-muted-foreground">Rabattcodes erstellen, versenden und auswerten.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Neu laden
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Gutschein erstellen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Neuer Gutschein</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Code</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                    <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, code: generateGutscheinCode() }))}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Typ</Label>
                    <Select value={form.typ} onValueChange={(v) => setForm((f) => ({ ...f, typ: v as GutscheinTyp }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYP_LABELS) as GutscheinTyp[]).map((t) => (
                          <SelectItem key={t} value={t}>{TYP_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{form.typ === "prozent" ? "Prozent" : "Betrag CHF"}</Label>
                    <Input
                      type="number" min="0" step="0.01" className="mt-1"
                      disabled={form.typ === "gratis_versand"}
                      value={form.wert}
                      onChange={(e) => setForm((f) => ({ ...f, wert: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Mindestbestellwert CHF</Label>
                    <Input type="number" min="0" step="0.01" className="mt-1" value={form.mindestbestellwert}
                      onChange={(e) => setForm((f) => ({ ...f, mindestbestellwert: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Max. Verwendungen (leer = unbegrenzt)</Label>
                    <Input type="number" min="1" className="mt-1" value={form.max_verwendungen}
                      onChange={(e) => setForm((f) => ({ ...f, max_verwendungen: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Gültig ab</Label>
                    <Input type="date" className="mt-1" value={form.gueltig_ab}
                      onChange={(e) => setForm((f) => ({ ...f, gueltig_ab: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Gültig bis</Label>
                    <Input type="date" className="mt-1" value={form.gueltig_bis}
                      onChange={(e) => setForm((f) => ({ ...f, gueltig_bis: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Kunde (optional)</Label>
                  <Select value={form.kunde_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, kunde_id: v === "none" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Kein Kunde" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Kunde</SelectItem>
                      {kunden.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {[k.vorname, k.name].filter(Boolean).join(" ")}{k.email ? ` · ${k.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Grund / Anlass</Label>
                  <Input className="mt-1" placeholder="z.B. Entschuldigung Lieferverzug" value={form.grund}
                    onChange={(e) => setForm((f) => ({ ...f, grund: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Interne Notiz</Label>
                  <Textarea rows={2} className="mt-1" value={form.notiz}
                    onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">Sofort aktiv</span>
                  <Switch checked={form.aktiv} onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Gutscheine total", value: String(stats.total) },
          { label: "Aktiv", value: String(stats.aktiv) },
          { label: "Eingelöst", value: String(stats.eingeloest) },
          { label: "Rabatt gewährt", value: CHF(stats.rabattTotal) },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 md:p-4">
            <div className="text-lg md:text-xl font-bold leading-tight">{s.value}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Code oder Anlass suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Noch keine Gutscheine erstellt.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((g) => {
              const st = statusOf(g);
              const gutscheinVerwendungen = verwendungen?.filter(v => v.gutschein_id === g.id) || [];
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{g.code}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {gutscheinWertLabel(g)}
                      {(g.mindestbestellwert ?? 0) > 0 && ` · ab ${CHF(Number(g.mindestbestellwert))}`}
                      {g.gueltig_bis && ` · bis ${new Date(g.gueltig_bis).toLocaleDateString("de-CH")}`}
                      {g.grund && ` · ${g.grund}`}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {gutscheinVerwendungen.length > 0 ? (
                      <span className="text-xs text-emerald-600 font-medium">
                        ✓ Eingelöst {new Date(gutscheinVerwendungen[0].verwendet_am).toLocaleDateString("de-CH")}
                        · CHF {Number(gutscheinVerwendungen[0].rabatt_betrag).toFixed(2)} Rabatt
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Noch nicht eingelöst</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void copyCode(g.code)} title="Code kopieren">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openMail(g)}>
                      <Mail className="w-4 h-4" /> Senden
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void toggleAktiv(g)}>
                          {g.aktiv ? "Deaktivieren" : "Aktivieren"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(g.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!mailFor} onOpenChange={(o) => !o && setMailFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gutschein {mailFor?.code} versenden</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">E-Mail-Adresse</Label>
              <Input type="email" className="mt-1" value={mailTo} onChange={(e) => setMailTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Name (optional)</Label>
              <Input className="mt-1" value={mailName} onChange={(e) => setMailName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Persönliche Nachricht (optional)</Label>
              <Textarea rows={3} className="mt-1" value={mailText} onChange={(e) => setMailText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailFor(null)}>Abbrechen</Button>
            <Button onClick={sendMail} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gutschein löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Code kann danach nicht mehr eingelöst werden. Diese Aktion lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
