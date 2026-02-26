import { ScrollReveal } from "@/components/ScrollReveal";

const WebsiteDatenschutz = () => (
  <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Datenschutzerklärung</h1>
          <p className="text-white/50">3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG</p>
        </div>
      </ScrollReveal>
      <div className="space-y-8">
        {[
          { title: "1. Allgemeine Hinweise", content: "Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Wir behandeln Ihre Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften." },
          { title: "2. Verantwortliche Stelle", content: "3DMuscio, Gartensiedlung 13, 8360 Eschlikon TG, Schweiz\nE-Mail: info@3dmuscio.ch" },
          { title: "3. Erhebung personenbezogener Daten", content: "Wir erheben Daten nur, soweit dies zur Bereitstellung unserer Leistungen erforderlich ist: Name, Adresse, E-Mail, Telefon, Bestelldaten." },
          { title: "4. Datensicherheit", content: "Wir schützen Ihre Daten durch geeignete technische und organisatorische Massnahmen gegen unbefugten Zugriff." },
          { title: "5. Ihre Rechte", content: "Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Sperrung oder Löschung Ihrer bei uns gespeicherten Daten." },
          { title: "6. Kontakt", content: "Für Fragen zur Datenverarbeitung wenden Sie sich bitte an: info@3dmuscio.ch" },
        ].map((s, i) => (
          <ScrollReveal key={i}>
            <section>
              <h2 className="text-xl font-bold text-white mb-3">{s.title}</h2>
              <p className="text-white/50 leading-relaxed whitespace-pre-line">{s.content}</p>
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

export default WebsiteDatenschutz;
