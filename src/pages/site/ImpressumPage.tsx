import { ScrollReveal } from "@/components/site/ScrollReveal";

const ImpressumPage = () => (
  <div className="pt-12 pb-16">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">Impressum</h1>
        </div>
      </ScrollReveal>

      <div className="space-y-8 text-foreground">
        <ScrollReveal>
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">Angaben gemäss Art. 3 UWG</h2>
            <p className="text-muted-foreground leading-relaxed">
              3DMuscio<br />Gartensiedlung 13<br />8360 Eschlikon TG<br />Schweiz
            </p>
          </section>
        </ScrollReveal>
        <ScrollReveal>
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">Inhaber</h2>
            <p className="text-muted-foreground">Jorim Moos</p>
          </section>
        </ScrollReveal>
        <ScrollReveal>
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">Kontakt</h2>
            <p className="text-muted-foreground">
              Website: <a href="https://www.3dmuscio.com" className="text-primary hover:underline">www.3dmuscio.com</a><br />
              E-Mail: <a href="mailto:info@3dmuscio.com" className="text-primary hover:underline">info@3dmuscio.com</a>
            </p>
          </section>
        </ScrollReveal>
        <ScrollReveal>
          <section>
            <h2 className="font-heading text-xl font-bold mb-3">Haftungsausschluss</h2>
            <p className="text-muted-foreground leading-relaxed">
              Der Autor übernimmt keinerlei Gewähr für inhaltliche Richtigkeit, Genauigkeit oder Vollständigkeit der Informationen.
              Haftungsansprüche aus Nutzung oder Nichtnutzung der publizierten Informationen werden ausgeschlossen.
            </p>
          </section>
        </ScrollReveal>
        <div className="border-t border-border pt-6 text-sm text-muted-foreground">
          Stand: {new Date().toLocaleDateString("de-CH", { month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  </div>
);

export default ImpressumPage;
