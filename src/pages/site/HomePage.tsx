import React from "react";
import { Link } from "react-router-dom";
import { Calculator, Zap, ShieldCheck, Truck, ArrowRight, Box, Layers, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium mb-6">
              <Zap className="w-3.5 h-3.5" /> Made in Switzerland
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
              3D-Druck.<br />
              <span className="text-primary">Schnell. Präzise. Fair.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Von der STL-Datei zum fertigen Bauteil – online kalkulieren, hochladen, drucken lassen.
              Direkter Kontakt, transparente Preise, professionelle Qualität.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/kalkulator-online">
                  <Calculator className="w-4 h-4" /> Preis berechnen
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/kontakt">Anfrage stellen</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: "Schnelle Lieferung", text: "Standard 5–7 Werktage, Express auf Anfrage." },
          { icon: ShieldCheck, title: "Schweizer Qualität", text: "Sorgfältige Nachbearbeitung, präzise Toleranzen." },
          { icon: Truck, title: "Versand schweizweit", text: "A-Post oder Abholung in Absprache." },
        ].map(f => (
          <div key={f.title} className="bg-card border border-border rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      {/* Materials */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Materialien</h2>
        <p className="text-muted-foreground mb-8">Vom Prototyp bis zum belastbaren Funktionsteil.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Box, name: "PLA", desc: "Standard, viele Farben" },
            { icon: Layers, name: "PETG", desc: "Schlagfest, lebensmittelecht" },
            { icon: Cpu, name: "ABS / ASA", desc: "Belastbar, UV-stabil" },
            { icon: Zap, name: "TPU", desc: "Flexibel, gummiartig" },
          ].map(m => (
            <div key={m.name} className="bg-card border border-border rounded-lg p-5 text-center">
              <m.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Bereit für dein Projekt?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Lade deine STL-Datei hoch und bekomme sofort einen unverbindlichen Preis.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/kalkulator-online">Jetzt kalkulieren <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
