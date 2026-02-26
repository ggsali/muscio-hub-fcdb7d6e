import { ScrollReveal } from "@/components/ScrollReveal";

const WebsiteAGB = () => (
  <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Allgemeine Geschäftsbedingungen</h1>
          <p className="text-white/50">3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG · Schweiz<br />
            E-Mail: <a href="mailto:info@3dmuscio.ch" className="text-[#00cc66] hover:underline">info@3dmuscio.ch</a></p>
        </div>
      </ScrollReveal>
      <div className="space-y-8 text-white">
        {[
          { title: "1. Geltungsbereich", content: "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge, die zwischen 3DMuscio und ihren Kunden über den Verkauf von 3D-gedruckten Produkten im Versandhandel abgeschlossen werden." },
          { title: "2. Vertragspartner", content: "Der Kaufvertrag kommt zustande mit: 3DMuscio, Gartensiedlung 13, 8360 Eschlikon TG, Schweiz. E-Mail: info@3dmuscio.ch" },
          { title: "3. Lieferung", content: "Die Lieferung erfolgt ausschliesslich per Versand. Standardlieferung innerhalb von 48 Stunden nach Bestellbestätigung." },
          { title: "4. Preise und Versandkosten", content: "Alle Preise verstehen sich inklusive MwSt. Ab einem Warenwert von CHF 65 ist die Lieferung versandkostenfrei." },
          { title: "5. Zahlung", content: "Verfügbare Zahlungsarten: Banküberweisung, Kreditkarte und TWINT." },
          { title: "6. Gewährleistung", content: "Es gelten die gesetzlichen Gewährleistungsrechte. Bei Mängeln kontaktieren Sie uns bitte per E-Mail." },
          { title: "7. Gerichtsstand", content: "Es gilt das Recht der Schweiz. Der Gerichtsstand ist 8360 Eschlikon TG." },
        ].map((s, i) => (
          <ScrollReveal key={i}>
            <section>
              <h2 className="text-xl font-bold text-white mb-3">{s.title}</h2>
              <p className="text-white/50 leading-relaxed">{s.content}</p>
            </section>
          </ScrollReveal>
        ))}
        <ScrollReveal>
          <div className="border-t border-white/8 pt-6 text-sm text-white/30">
            Stand: {new Date().toLocaleDateString("de-CH", { month: "long", year: "numeric" })}
          </div>
        </ScrollReveal>
      </div>
    </div>
  </div>
);

export default WebsiteAGB;
