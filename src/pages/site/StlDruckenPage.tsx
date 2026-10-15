import AnswerLanding from "@/components/site/AnswerLanding";
import Seo from "@/components/site/Seo";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";

const PATH = "/stl-drucken-lassen";

const faqs = [
  { q: "Was kostet es, eine STL-Datei drucken zu lassen?", a: "Kleine Teile gibt es bei uns ab CHF 5.–. Den genauen Preis siehst du sofort, wenn du die Datei im Online-Kalkulator hochlädst." },
  { q: "Gibt es einen Mindestbestellwert?", a: "Nein. Du kannst schon ein einzelnes Teil drucken lassen." },
  { q: "Wie schnell ist mein Teil fertig?", a: "Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich. Die tatsächliche Produktions- und Lieferzeit hängt von Material, Auftragsumfang und Auslastung ab." },
  { q: "Welche Dateien kann ich hochladen?", a: "STL, 3MF, OBJ und STEP. Die meisten Modelle von Printables oder Thingiverse sind STL-Dateien und passen direkt." },
  { q: "Liefert ihr auch nach Liechtenstein?", a: "Ja. Wir versenden mit der Post in die ganze Schweiz und nach Liechtenstein." },
  { q: "Kann ich auch als Privatperson bestellen?", a: "Ja, gerne. Viele unserer Kunden sind Privatpersonen mit Ersatzteilen, Halterungen oder Modellen." },
];

export default function StlDruckenPage() {
  return (
    <>
      <Seo
        title="STL drucken lassen Schweiz – ab CHF 5 | 3DMuscio"
        description="STL-Datei hochladen, Sofortpreis sehen mit schneller Fertigung (bei geeigneten Aufträgen in 48 h möglich). 3D-Druck ab 1 Stück für Privat und Firmen, Versand in die Schweiz und nach Liechtenstein."
        path={PATH}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "STL-Datei drucken lassen",
            serviceType: "3D-Druck",
            url: `${SITE_URL}${PATH}`,
            provider: { "@id": `${SITE_URL}/#organization` },
            areaServed: [{ "@type": "Country", name: "Schweiz" }, { "@type": "Country", name: "Liechtenstein" }],
          },
          breadcrumbJsonLd([{ name: "Start", path: "/" }, { name: "STL drucken lassen", path: PATH }]),
          faqJsonLd(faqs),
        ]}
      />
      <AnswerLanding
        eyebrow="STL drucken lassen"
        h1="STL-Datei drucken lassen – einfach hochladen, Preis sofort sehen"
        shortAnswer="Du hast eine STL-Datei und keinen 3D-Drucker? Lade sie im Kalkulator hoch, wähle Material und Farbe und bestelle direkt. Ab CHF 5.–, ab 1 Stück, schnelle Fertigung (bei geeigneten Aufträgen in 48 Stunden möglich) – Versand in die ganze Schweiz und nach Liechtenstein."
        breadcrumb={[{ name: "Start", to: "/" }, { name: "STL drucken lassen", to: PATH }]}
        sections={[
          { title: "So funktioniert es", bullets: [
            "STL-, 3MF-, OBJ- oder STEP-Datei im Kalkulator hochladen",
            "Material, Farbe und Qualität wählen – der Preis wird sofort berechnet",
            "Online bezahlen, wir drucken in Eschlikon TG",
            "Versand mit der Post – Fertigung bei geeigneten Aufträgen in 48 h möglich",
          ] },
          { title: "Warum 3DMuscio", bullets: [
            "Ab CHF 5.– pro Teil, kein Mindestbestellwert",
            "Fester Preis vor der Bestellung – keine Überraschungen",
            "Persönliche Prüfung jeder Datei vor dem Druck",
            "Gedruckt in der Schweiz",
          ] },
          { title: "Typische Aufträge", bullets: [
            "Ersatzteile für Haushalt, Wohnwagen, Velo oder Oldtimer",
            "Halterungen, Gehäuse und Adapter",
            "Modelle und Figuren von Printables oder Thingiverse",
            "Prototypen und Kleinserien für Firmen",
          ] },
          { title: "Materialien", text: "PLA für Modelle und Alltagsteile, PETG für robuste Teile, ASA für draussen und TPU für flexible Teile. Unsicher? Wir beraten dich gerne." },
        ]}
        faqs={faqs}
        related={[
          { label: "Online-Kalkulator", to: "/kalkulator-online", text: "STL hochladen und Sofortpreis sehen" },
          { label: "Materialien", to: "/materialien", text: "Welches Material passt?" },
          { label: "3D-Druck Kosten", to: "/wissen/3d-druck-kosten-schweiz", text: "Wovon der Preis abhängt" },
        ]}
        ctaTitle="Jetzt STL hochladen"
        ctaText="Preis in Sekunden – ohne Anmeldung."
      />
    </>
  );
}
