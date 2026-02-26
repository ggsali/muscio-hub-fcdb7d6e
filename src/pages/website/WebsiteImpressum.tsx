import { ScrollReveal } from "@/components/ScrollReveal";

const WebsiteImpressum = () => (
  <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Rechtliches</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Impressum</h1>
        </div>
      </ScrollReveal>
      <div className="space-y-8">
        {[
          { title: "Angaben gemäss Art. 3 UWG", content: "3DMuscio\nGartensiedlung 13\n8360 Eschlikon TG\nSchweiz" },
          { title: "Inhaber", content: "Jorim Moos" },
          { title: "Kontakt", content: "Website: www.3dmuscio.ch\nE-Mail: info@3dmuscio.ch" },
          { title: "Haftungsausschluss", content: "Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen Richtigkeit, Genauigkeit und Vollständigkeit der Informationen." },
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

export default WebsiteImpressum;
