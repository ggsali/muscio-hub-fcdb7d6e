import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";

const faqs = [
  {
    q: "Was kostet ein 3D-Druck in der Schweiz?",
    a: "Der Preis hängt vom Materialverbrauch, der Druckzeit, der Qualitätsstufe und der Nachbearbeitung ab. Kleine, einfache Teile starten bei uns ab CHF 5.–; den exakten Preis für deine Datei zeigt der Online-Kalkulator sofort an.",
  },
  {
    q: "Warum ist ein grosses Teil teurer als ein kleines?",
    a: "Weil beides steigt: Materialverbrauch und Druckzeit. Die Druckzeit ist der grösste Kostenfaktor – ein doppelt so hohes Teil braucht in der Regel deutlich mehr als die doppelte Zeit.",
  },
  {
    q: "Wird der Rüstaufwand pro Teil verrechnet?",
    a: "Nein. Die Rüstkosten fallen pro Auftrag nur einmal an, nicht pro Stück. Deshalb sinkt der Stückpreis, wenn du mehrere Teile zusammen bestellst.",
  },
  {
    q: "Gibt es Mengenrabatt?",
    a: "Ja. Der Mengenrabatt wird im Kalkulator automatisch berechnet und direkt bei der Stückzahl angezeigt.",
  },
  {
    q: "Kostet der Preisvorschlag etwas?",
    a: "Nein. Die Kalkulation im Online-Kalkulator ist kostenlos und benötigt keine Anmeldung.",
  },
  {
    q: "Fallen Versandkosten an?",
    a: "Versand erfolgt mit Post oder DHL innerhalb der Schweiz; ab CHF 65 Bestellwert ist der Versand kostenlos. Abholung in Eschlikon TG ist ebenfalls möglich.",
  },
];

const table = {
  title: "Die Kostenfaktoren im Überblick",
  headers: ["Faktor", "Einfluss", "Was du beeinflussen kannst"],
  rows: [
    ["Materialverbrauch", "Preis pro Gramm × Gewicht", "Wandstärke, Füllgrad, Hohlräume"],
    ["Druckzeit", "grösster Kostenblock", "Qualitätsstufe, Bauteilhöhe, Orientierung"],
    ["Material-Typ", "PLA günstig, ASA/Nylon/Resin teurer", "Material passend zur Anwendung wählen"],
    ["Qualitätsstufe", "feinere Schichten = mehr Zeit", "nur dort fein drucken, wo es nötig ist"],
    ["Stützstrukturen", "zusätzliches Material und Zeit", "Geometrie druckgerecht gestalten"],
    ["Nachbearbeitung", "Aufwand pro Teil", "nur bestellen, was gebraucht wird"],
    ["Rüstkosten", "einmal pro Auftrag", "mehrere Teile zusammen bestellen"],
    ["Stückzahl", "Mengenrabatt", "Serien statt Einzelbestellungen"],
  ],
};

export default function KostenPage() {
  const path = "/wissen/3d-druck-kosten-schweiz";

  return (
    <>
      <Seo
        title="3D-Druck Kosten Schweiz: Preise & Faktoren | 3DMuscio"
        description="Was kostet 3D-Druck in der Schweiz? Alle Preisfaktoren erklärt: Material, Druckzeit, Qualität, Nachbearbeitung, Rüstkosten und Mengenrabatt. Ab CHF 5.–."
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "3D-Druck Kosten Schweiz – so entsteht der Preis",
            description:
              "Erklärung aller Preisfaktoren im 3D-Druck: Materialverbrauch, Druckzeit, Qualitätsstufe, Nachbearbeitung, Rüstkosten und Mengenrabatt.",
            url: `${SITE_URL}${path}`,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Wissen", path },
            { name: "3D-Druck Kosten Schweiz", path },
          ]),
          faqJsonLd(faqs),
        ]}
      />
      <AnswerLanding
        eyebrow="Wissen"
        h1="3D-Druck Kosten in der Schweiz – so entsteht der Preis"
        shortAnswer="Der Preis eines 3D-Drucks setzt sich aus Materialverbrauch, Druckzeit, Qualitätsstufe und Nachbearbeitung zusammen; die Rüstkosten fallen pro Auftrag nur einmal an. Bei 3DMuscio starten einfache Teile ab CHF 5.–, und der Online-Kalkulator zeigt dir für deine eigene Datei sofort den exakten Preis samt Aufschlüsselung."
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Wissen", to: path },
          { name: "3D-Druck Kosten Schweiz", to: path },
        ]}
        sections={[
          {
            title: "Die zwei wichtigsten Treiber: Material und Zeit",
            text: "Material wird nach Gewicht verrechnet – der Preis pro Gramm hängt vom Filament oder Harz ab. Der grössere Anteil ist meist die Maschinenzeit: je höher das Bauteil und je feiner die Schichten, desto länger druckt es. Deshalb kostet ein hohles, grosszügig dimensioniertes Teil oft weniger als ein kompaktes, massives.",
          },
          {
            title: "So senkst du die Kosten, ohne Qualität zu verlieren",
            bullets: [
              "Wandstärke und Füllgrad nur so hoch wie nötig",
              "massive Bereiche aushöhlen",
              "Qualitätsstufe an die Funktion anpassen",
              "Bauteil so gestalten, dass wenig Stützmaterial nötig ist",
              "mehrere Teile in einem Auftrag bestellen (Rüstkosten nur einmal)",
              "grössere Stückzahlen für Mengenrabatt nutzen",
            ],
          },
          {
            title: "Materialwahl und Preis",
            text: "PLA und PETG sind die günstigsten Standardmaterialien. ABS und ASA liegen darüber, Nylon und Resin nochmals höher – dafür bieten sie Temperatur-, UV- oder Detailvorteile. Wähle das Material nach der Anwendung, nicht nach dem Preis: ein zu schwaches Material kostet am Ende mehr, weil das Teil ersetzt werden muss.",
          },
          {
            title: "Transparente Kalkulation statt Pauschalpreise",
            text: "Unser Kalkulator analysiert deine Datei, ermittelt Volumen, Gewicht und Druckzeit und weist Material-, Zeit- und Nachbearbeitungsanteil separat aus. Du siehst also nicht nur den Endpreis, sondern auch, woraus er entsteht – und kannst gezielt an den Parametern drehen.",
          },
          {
            title: "Preis und Lieferzeit hängen zusammen",
            text: "Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung. Express ist auf Anfrage möglich und wird individuell kalkuliert, weil wir dafür laufende Aufträge umplanen müssen.",
          },
        ]}
        table={table}
        faqs={faqs}
        related={[
          { label: "Online-Kalkulator", to: "/kalkulator-online", text: "Preis für deine Datei in 60 Sekunden." },
          { label: "Materialien und Preise", to: "/materialien", text: "Eigenschaften und Preis pro Gramm." },
          { label: "3D-Druck vs Spritzguss", to: "/vergleich/3d-druck-vs-spritzguss", text: "Ab wann sich eine Form lohnt." },
          { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien", text: "Mengenrabatt und Serienpreise." },
        ]}
        ctaTitle="Exakten Preis für dein Teil berechnen"
        ctaText="Datei hochladen, Material wählen, Preis mit vollständiger Aufschlüsselung sehen."
      />
    </>
  );
}
