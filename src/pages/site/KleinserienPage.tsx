import Seo from "@/components/site/Seo";
import ServiceLanding from "@/components/site/ServiceLanding";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Kleinserienfertigung Kunststoff Schweiz",
  serviceType: "3D Druck Kleinserie",
  description:
    "Kleinserien aus Kunststoff per 3D Druck: ab 1 Stück, ohne Spritzgussform, gefertigt in Eschlikon TG und geliefert in die ganze Schweiz.",
  provider: { "@type": "LocalBusiness", name: "3DMuscio", url: "https://3dmuscio.com" },
  areaServed: "CH",
  url: "https://3dmuscio.com/kleinserien",
};

export default function KleinserienPage() {
  return (
    <>
      <Seo
        title="Kleinserie Kunststoff Schweiz – 3D Druck Kleinserienfertigung | 3DMuscio"
        description="Kleinserienfertigung per 3D Druck: Kunststoffteile ab 1 Stück, ohne Spritzgussform und ohne Mindestbestellmenge. Gefertigt in der Schweiz, Preis sofort online."
        path="/kleinserien"
        jsonLd={jsonLd}
      />
      <ServiceLanding
        eyebrow="Leistung"
        h1="Kleinserien aus Kunststoff – 3D Druck Kleinserienfertigung"
        lead="Serien von 1 bis einige hundert Teile fertigen wir per 3D Druck – ohne Spritzgussform, ohne Mindestbestellmenge und ohne lange Vorlaufzeit. Ideal für Nischenprodukte, Zubehör und Baugruppen, bei denen sich ein Werkzeug nie rechnen würde."
        blocks={[
          {
            title: "Keine Mindestbestellmenge",
            text: "Wir starten ab einem Stück. Du bestellst genau die Menge, die du brauchst, und kannst jederzeit nachproduzieren – ohne Lagerrisiko und ohne Formkosten.",
          },
          {
            title: "Wann sich 3D Druck gegen Spritzguss rechnet",
            bullets: [
              "Stückzahlen bis wenige hundert Teile",
              "Design ändert sich noch oder wird laufend verbessert",
              "Varianten in unterschiedlichen Farben oder Grössen",
              "Kurzfristiger Bedarf und Nachschub auf Abruf",
              "Ersatz- und Zubehörteile für bestehende Produkte",
              "Markttest vor der Investition in ein Werkzeug",
            ],
          },
          {
            title: "Materialien und Qualität",
            text: "FDM in PLA, PETG, ABS, ASA und TPU sowie SLA Resin. Jede Serie wird mit identischen Druckparametern gefertigt und vor dem Versand geprüft, damit alle Teile gleich ausfallen.",
          },
        ]}
        steps={[
          { title: "Datei & Menge", text: "STL oder STEP hochladen und die gewünschte Stückzahl angeben." },
          { title: "Preis pro Stück", text: "Der Kalkulator zeigt Material-, Zeit- und Mengeneffekte transparent an." },
          { title: "Serienfertigung", text: "Fertigung in einem Los mit gleichen Parametern für konstante Qualität." },
          { title: "Nachschub", text: "Nachbestellungen jederzeit möglich – die Daten bleiben bei uns hinterlegt." },
        ]}
        ctaTitle="Kleinserie kalkulieren"
        ctaText="Stückzahl eingeben und den Preis pro Teil sofort sehen – ganz ohne Anfrageschleife."
      />
    </>
  );
}
