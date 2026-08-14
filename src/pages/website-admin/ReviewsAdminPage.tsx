import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Eye, EyeOff, Check, Trash2, Plus, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Review {
  id: string; customer_name: string; customer_email: string | null;
  kommentar: string | null; rating: number; freigegeben: boolean;
  sichtbar_auf_website: boolean; source: string | null; created_at: string;
}

const SOURCE_OPTIONS = [
  { value: "Google", label: "Google" },
  { value: "Direkt", label: "Direkt" },
  { value: "Andere", label: "Andere" },
];

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [kommentar, setKommentar] = useState("");
  const [source, setSource] = useState("Google");
  const [date, setDate] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reviews")
      .select("id, customer_name, customer_email, kommentar, rating, freigegeben, sichtbar_auf_website, source, created_at")
      .order("created_at", { ascending: false });
    setReviews((data as Review[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setRating(0);
    setKommentar("");
    setSource("Google");
    setDate(new Date());
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name ist ein Pflichtfeld.");
      return;
    }
    if (rating < 1 || rating > 5) {
      toast.error("Bitte eine Bewertung von 1–5 Sternen vergeben.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      customer_name: trimmedName,
      customer_email: email.trim() || null,
      rating,
      kommentar: kommentar.trim() || null,
      source,
      created_at: date.toISOString(),
      freigegeben: true,
      sichtbar_auf_website: true,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Bewertung hinzugefügt ✓");
    resetForm();
    setDialogOpen(false);
    load();
  };

  const update = async (id: string, patch: Partial<Review>) => {
    await supabase.from("reviews").update(patch).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Bewertung wirklich löschen?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    toast.success("Gelöscht");
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-heading text-xl md:text-3xl font-bold text-foreground mb-2">Bewertungen</h1>
          <p className="text-muted-foreground">Reviews freigeben, ausblenden oder löschen.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1.5" /> Bewertung manuell hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bewertung manuell hinzufügen</DialogTitle>
              <DialogDescription>
                Erstelle einen neuen Review-Eintrag, der sofort live geschaltet wird.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="review-name">Name *</Label>
                <Input
                  id="review-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-email">E-Mail</Label>
                <Input
                  id="review-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@beispiel.ch"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Bewertung *</Label>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i + 1)}
                      className="p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          i < rating ? "fill-primary text-primary" : "text-border"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-comment">Kommentar</Label>
                <Textarea
                  id="review-comment"
                  value={kommentar}
                  onChange={(e) => setKommentar(e.target.value)}
                  placeholder="Was hat dir besonders gut gefallen?"
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-source">Quelle</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger id="review-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {date ? format(date, "PPP", { locale: de }) : <span>Datum wählen</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={de}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Speichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="h-6" />

      {loading ? <p className="text-muted-foreground">Lädt…</p> : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{r.customer_name}</p>
                    {!r.freigegeben && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 font-bold">Wartend</span>}
                    {r.freigegeben && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">Live</span>}
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-primary text-primary" : "text-border"}`} />
                    ))}
                  </div>
                  {r.kommentar && <p className="text-sm text-foreground">{r.kommentar}</p>}
                  {r.customer_email && <p className="text-xs text-muted-foreground mt-2">{r.customer_email}</p>}
                </div>
                <div className="flex gap-2">
                  {!r.freigegeben ? (
                    <Button size="sm" onClick={() => update(r.id, { freigegeben: true })}><Check className="w-3.5 h-3.5 mr-1" /> Freigeben</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => update(r.id, { sichtbar_auf_website: !r.sichtbar_auf_website })}>
                      {r.sichtbar_auf_website ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="text-muted-foreground text-sm">Noch keine Bewertungen.</p>}
        </div>
      )}
    </div>
  );
}
