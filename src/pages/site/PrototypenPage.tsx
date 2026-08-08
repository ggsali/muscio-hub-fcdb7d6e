import Seo from "@/components/site/Seo";
import ServiceLanding from "@/components/site/ServiceLanding";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Prototypen herstellen lassen – Rapid Prototyping Schweiz",
  serviceType: "Rapid Prototyping",
  description:
    "Prototypen per 3D Druck herstellen lassen: Funktionsmodelle, Designmuster und Testteile in FDM oder SLA, gefertigt in der Schweiz.",
  provider: { "@type": "LocalBusiness", name: "3DMuscio", url: "https://3dmuscio.com" },
  areaServed: "CH",
  url: "https://3dmuscio.com/prototypen",
};

export default function PrototypenPage() {
  return (
    <>
      <Seo
        title="Prototyp herstellen lassen Schweiz – Rapid Prototyping | 3DMuscio"
        description="Rapid Prototyping aus der Schweiz: Funktionsmodelle und Designmuster per FDM oder SLA in 2–7 Werktagen. STL hochladen, Preis sofort online berechnen."
        path="/prototypen"
        jsonLd={jsonLd}
      />
      <ServiceLanding
        eyebrow="Leistung"
        h1="Prototyp herstellen lassen – Rapid Prototyping in der Schweiz"
        lead="Von der Idee zum greifbaren Teil in wenigen Tagen: 3DMuscio fertigt Prototypen, Funktionsmodelle und Designmuster per FDM und SLA Druck. So testest du Passform, Funktion und Haptik, bevor Werkzeugkosten entstehen."
        blocks={[
          {
            title: "Was ist Rapid Prototyping?",
            text: "Rapid Prototyping bezeichnet die schnelle Herstellung physischer Muster direkt aus CAD-Daten. Statt Wochen für Formenbau entsteht das Teil in Stunden bis Tagen – Änderungen kosten nur eine neue Datei.",
          },
          {
            title: "Vorteile für Entwicklung und Konstruktion",
            bullets: [
              "Keine Werkzeug- oder Formkosten",
              "Iterationen in Tagen statt Wochen",
              "Passform und Montage früh am realen Teil prüfen",
              "Funktionstests mit belastbaren Materialien (PETG, ABS, ASA)",
              "Feine Details und glatte Oberflächen per SLA Resin",
              "Direkter Kontakt zum Inhaber, technische Rückmeldung inklusive",
            ],
          },
          {
            title: "Prototypen-Arten, die wir fertigen",
            bullets: [
              "Konzept- und Designmodelle",
              "Funktionsprototypen für mechanische Tests",
              "Passform- und Montageprüfteile",
              "Vorserienteile vor dem Spritzguss",
              "Messe- und Präsentationsmuster",
            ],
          },
        ]}
        steps={[
          { title: "CAD-Daten hochladen", text: "STL, STEP oder OBJ im Online-Kalkulator hochladen." },
          { title: "Material & Qualität wählen", text: "FDM oder SLA, Schichtstärke und Infill passend zum Einsatzzweck." },
          { title: "Druck & Prüfung", text: "Fertigung in Eschlikon TG inklusive Sichtprüfung und Nachbearbeitung." },
          { title: "Iterieren", text: "Feedback einarbeiten und die nächste Version drucken – so oft wie nötig." },
        ]}
        ctaTitle="Prototyp jetzt kalkulieren"
        ctaText="Datei hochladen, Material wählen, Preis sehen. Express-Fertigung auf Anfrage möglich."
      />
    </>
  );
}
