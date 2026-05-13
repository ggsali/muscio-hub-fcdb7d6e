import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Eye, EyeOff, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Review {
  id: string; customer_name: string; customer_email: string | null;
  kommentar: string | null; rating: number; freigegeben: boolean;
  sichtbar_auf_website: boolean; source: string | null; created_at: string;
}

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reviews")
      .select("id, customer_name, customer_email, kommentar, rating, freigegeben, sichtbar_auf_website, source, created_at")
      .order("created_at", { ascending: false });
    setReviews((data as Review[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
      <h1 className="font-heading text-xl md:text-3xl font-bold text-foreground mb-2">Bewertungen</h1>
      <p className="text-muted-foreground mb-8">Reviews freigeben, ausblenden oder löschen.</p>

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
