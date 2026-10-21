import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";

const faqs = [
  {
    q: "Welche Weihnachtsgeschenke kann ich bei 3DMuscio bestellen?",
    a: "Persönliche 3D-Druck-Geschenke aus der Schweiz: individuelle Figuren und Modelle, Namensschilder, Halterungen, Organizer, Dekoration oder eigene Ideen als Unikat. Dazu gibt es Geschenkgutscheine und fertige Produkte im Shop.",
  },
  {
    q: "Kann ich ein eigenes Design als Geschenk drucken lassen?",
    a: "Ja. Lade deine 3D-Datei (STL, STEP, 3MF oder OBJ) im Online-Kalkulator hoch, wähle Material und Farbe und sieh den Preis sofort. Ab 1 Stück möglich.",
  },
  {
    q: "Habe ich keine 3D-Datei – geht es trotzdem?",
    a: "Ja. Schreib uns deine Idee oder schick uns ein Foto bzw. eine Skizze über das Kontaktformular. Wir melden uns mit einem Vorschlag.",
  },
  {
    q: "Gibt es einen Geschenkgutschein?",
    a: "Ja. Den 3D-Druck-Gutschein gibt es in CHF 25, 50, 100 oder als Wunschbetrag. Er kommt sofort per E-Mail, ist 12 Monate gültig und im Shop sowie im Kalkulator einlösbar.",
  },
  {
    q: "Bis wann muss ich bestellen, damit es vor Weihnachten ankommt?",
    a: "Bestelle am besten früh, denn die Fertigungszeit hängt von Material, Umfang und Auslastung ab. Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich. Bei grösseren oder mehreren Teilen planen wir mehr Zeit ein – schreib uns bei einer knappen Frist direkt.",
  },
  {
    q: "Wohin wird geliefert?",
    a: "Versand per Post oder DHL in der ganzen Schweiz. Abholung in Eschlikon TG ist ebenfalls möglich.",
  },
];

export default function WeihnachtenPage() {
  const path = "/weihnachtsgeschenke";
  return (
    <>
      <Seo
        title="Weihnachtsgeschenke aus dem 3D-Drucker – Schweiz | 3DMuscio"
        description="Persönliche Weihnachtsgeschenke aus dem 3D-Druck: Unikate nach deiner Idee, Geschenkgutschein und Shop-Produkte. Gefertigt in Eschlikon TG, Versand in die ganze Schweiz."
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Weihnachtsgeschenke aus dem 3D-Drucker",
            url: `${SITE_URL}${path}`,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Weihnachtsgeschenke", path },
          ]),
          faqJsonLd(faqs),
        ]}
      />
      <AnswerLanding
        eyebrow="Weihnachten"
        h1="Weihnachtsgeschenke aus dem 3D-Drucker – persönlich und aus der Schweiz"
        shortAnswer="Bei 3DMuscio in Eschlikon TG bekommst du persönliche Weihnachtsgeschenke, die es sonst nirgends gibt: Unikate nach deiner Idee, fertige Produkte aus dem Shop oder einen Geschenkgutschein. Datei hochladen, Preis sofort sehen, Versand in der ganzen Schweiz."
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Weihnachtsgeschenke", to: path },
        ]}
        sections={[
          {
            title: "Geschenkideen aus dem 3D-Druck",
            bullets: [
              "Personalisierte Namensschilder, Schlüsselanhänger und Türschilder",
              "Figuren, Modelle und Miniaturen nach eigener Vorlage",
              "Organizer, Halterungen und Ständer für Schreibtisch, Werkstatt und Gaming",
              "Dekoration: Sterne, Lichter, Adventsschmuck und Tischdeko",
              "Ersatzteile und Wunschteile für Bastler und Technikfans",
              "Geschenkgutschein, wenn du dir nicht sicher bist",
            ],
          },
          {
            title: "So einfach geht es",
            text: "Datei im Online-Kalkulator hochladen, Material und Farbe wählen und den Preis direkt sehen. Ab 1 Stück, ohne Anmeldung. Hast du nur eine Idee oder ein Foto, schreib uns – wir helfen beim Umsetzen.",
          },
          {
            title: "Rechtzeitig bestellen",
            text: "Je früher du bestellst, desto entspannter wird es. Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich; die tatsächliche Zeit hängt von Material, Auftragsumfang und Auslastung ab. Gerade in der Adventszeit lohnt es sich, nicht bis zur letzten Woche zu warten.",
          },
          {
            title: "Gefertigt in der Schweiz",
            text: "Alle Teile entstehen in unserer Werkstatt in Eschlikon TG. Du bekommst Qualität aus der Region statt anonymer Massenware – ein Geschenk mit Geschichte.",
          },
        ]}
        faqs={faqs}
        related={[
          { label: "Geschenkgutschein", to: "/gutschein", text: "CHF 25, 50, 100 oder Wunschbetrag – sofort per E-Mail." },
          { label: "Online-Kalkulator", to: "/kalkulator-online", text: "Eigene Datei hochladen und Preis sehen." },
          { label: "Shop", to: "/shop", text: "Fertige Produkte direkt bestellen." },
          { label: "Projekte", to: "/projekte", text: "Echte Beispiele aus unserer Werkstatt." },
        ]}
        ctaTitle="Dein Weihnachtsgeschenk starten"
        ctaText="Datei hochladen, Material wählen, Preis sofort sehen."
      />
    </>
  );
}
