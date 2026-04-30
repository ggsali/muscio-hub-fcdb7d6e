import { ScrollReveal } from "@/components/site/ScrollReveal";

const AGBPage = () => (
  <div className="pt-12 pb-16">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className="text-muted-foreground">
            3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG · Schweiz<br />
            E-Mail: <a href="mailto:info@3dmuscio.com" className="text-primary hover:underline">info@3dmuscio.com</a>
          </p>
        </div>
      </ScrollReveal>

      <div className="space-y-8 text-foreground">
        {[
          ["1. Geltungsbereich", "Diese AGB gelten für alle Verträge zwischen 3DMuscio und ihren Kunden über den Verkauf von 3D-gedruckten Produkten im Versandhandel."],
          ["2. Vertragspartner", "Der Kaufvertrag kommt zustande mit: 3DMuscio, Gartensiedlung 13, 8360 Eschlikon TG, Schweiz · info@3dmuscio.com"],
          ["3. Angebot und Vertragsabschluss", "Die Darstellung der Produkte stellt kein bindendes Angebot dar. Mit der Bestellung geben Sie ein verbindliches Angebot ab. Der Vertrag kommt mit Auftragsbestätigung per E-Mail zustande."],
          ["4. Lieferung", "Lieferung erfolgt per Versand. Versandfertig in 1–7 Werktagen. Individuelle Druckaufträge können länger dauern. Bei Lieferungen ausserhalb der Schweiz trägt der Käufer Zoll- und Einfuhrkosten."],
          ["5. Preise und Versandkosten", "Alle Preise inkl. MwSt. (sofern anwendbar) zzgl. Versand. Ab CHF 65 versandkostenfrei innerhalb der Schweiz."],
          ["6. Zahlung", "Zahlungsarten: Rechnung, PayPal, Kreditkarte, Twint. Zahlung sofort fällig, sofern nicht anders vereinbart."],
          ["7. Widerrufsrecht", "14 Tage Widerrufsrecht ab Erhalt der Ware. Ausgeschlossen bei individuell angefertigten 3D-Druck-Produkten."],
          ["8. Gewährleistung", "Es gelten die gesetzlichen Gewährleistungsrechte. Bei Mängeln bitte info@3dmuscio.com kontaktieren."],
          ["9. Materialeigenschaften", "3D-gedruckte Waren weisen produktionsbedingt feine Schichtlinien auf. Geringfügige Farbabweichungen sind kein Reklamationsgrund."],
          ["10. Haftungsbegrenzung", "Schadensersatzansprüche sind ausgeschlossen, soweit kein Vorsatz oder grobe Fahrlässigkeit vorliegt."],
          ["11. Datenschutz", "Siehe separate Datenschutzerklärung."],
          ["12. Gerichtsstand", "Es gilt das Recht der Schweiz. Gerichtsstand: 8360 Eschlikon TG."],
        ].map(([title, body]) => (
          <ScrollReveal key={title}>
            <section>
              <h2 className="font-heading text-xl font-bold text-foreground mb-3">{title}</h2>
              <p className="text-muted-foreground leading-relaxed">{body}</p>
            </section>
          </ScrollReveal>
        ))}
        <div className="border-t border-border pt-6 text-sm text-muted-foreground">
          Stand: {new Date().toLocaleDateString("de-CH", { month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  </div>
);

export default AGBPage;
