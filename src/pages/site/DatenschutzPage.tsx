import { ScrollReveal } from "@/components/site/ScrollReveal";

const DatenschutzPage = () => (
  <div className="pt-24 pb-16">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">Datenschutzerklärung</h1>
          <p className="text-muted-foreground">
            3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG<br />
            <a href="mailto:info@3dmuscio.com" className="text-primary hover:underline">info@3dmuscio.com</a>
          </p>
        </div>
      </ScrollReveal>

      <div className="space-y-8 text-foreground">
        {[
          ["1. Allgemeine Hinweise", "Der Schutz Ihrer Daten ist uns wichtig. Wir behandeln Ihre Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften."],
          ["2. Verantwortliche Stelle", "3DMuscio, Gartensiedlung 13, 8360 Eschlikon TG, Schweiz · info@3dmuscio.com"],
          ["3. Erhobene Daten", "Name, Adresse, E-Mail, Telefonnummer, Bestelldaten, Zahlungsinformationen — nur soweit erforderlich."],
          ["4. Nutzung", "Verwendung zur Bearbeitung Ihrer Bestellungen, Kontaktaufnahme und internen Zwecken. Weitergabe nur an Versanddienstleister oder bei gesetzlicher Pflicht."],
          ["5. Cookies", "Die Website verwendet Cookies für Funktion, Sicherheit und Komfort. Sie können dies in Ihrem Browser konfigurieren."],
          ["6. Datensicherheit", "Wir schützen Ihre Daten durch geeignete technische und organisatorische Massnahmen."],
          ["7. Ihre Rechte", "Auskunft, Berichtigung, Sperrung und Löschung Ihrer Daten jederzeit auf Anfrage möglich."],
          ["8. Kontakt", "Für Fragen: info@3dmuscio.com"],
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

export default DatenschutzPage;
