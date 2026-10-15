import { Star, ArrowRight } from "lucide-react";
import { useReviewData } from "@/hooks/useReviewData";
import { company } from "@/data/company";

const fmtAvg = (n: number) => n.toFixed(1);

/**
 * Kompakter, serverseitig gerenderter Block für Regionsseiten:
 * Eckdaten (Preis, Zeit, Standort) und echte Kundenbewertungen als lesbarer Text im HTML.
 */
export default function ReviewsStrip({ region }: { region?: string }) {
  const data = useReviewData();
  const reviews = (data?.reviews ?? []).filter((r) => (r.kommentar ?? "").trim().length > 20).slice(0, 3);

  return (
    <section className="container mx-auto px-4 sm:px-6 pb-10 max-w-3xl" aria-label="Eckdaten und Kundenbewertungen">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="font-heading text-xl font-bold mb-3">
          3D-Druck{region ? ` für ${region}` : ""} auf einen Blick
        </h2>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Preis:</strong> ab CHF 5.–, keine Mindestmenge</li>
          <li><strong className="text-foreground">Produktionszeit:</strong> Fertigung bei geeigneten Aufträgen in 48 Stunden möglich</li>
          <li><strong className="text-foreground">Standort:</strong> {company.address.city} {company.address.regionCode}, Versand schweizweit</li>
          <li><strong className="text-foreground">Dateien:</strong> {company.fileFormats.join(", ")}</li>
        </ul>

        {data && data.count > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </span>
              {fmtAvg(data.average)} von 5 · {data.count} Kundenbewertungen
            </p>
            <div className="mt-4 space-y-4">
              {reviews.map((r) => (
                <blockquote key={r.id} className="border-l-2 border-primary/40 pl-4 text-sm">
                  <p className="text-foreground leading-relaxed">«{r.kommentar}»</p>
                  <footer className="text-xs text-muted-foreground mt-1">{r.customer_name}</footer>
                </blockquote>
              ))}
            </div>
            <a href="/#kundenstimmen" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-4">
              Alle Bewertungen <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
