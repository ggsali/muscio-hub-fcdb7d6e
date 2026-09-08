import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { breadcrumbJsonLd, faqJsonLd, localBusinessJsonLd, serviceJsonLd } from "@/data/company";

const PATH = "/3d-druck-schweiz";

const faqs = [
  {
    q: "Was bietet 3DMuscio genau an?",
    a: "3DMuscio ist ein Schweizer 3D-Druckservice aus Eschlikon TG. Wir fertigen Einzelteile, Prototypen, Funktionsteile, Ersatzteile und Kleinserien im FDM- und im SLA/Resin-Verfahren.",
  },
  {
    q: "Wo wird produziert?",
    a: "In Eschlikon im Kanton Thurgau. Versand erfolgt innerhalb der Schweiz mit Post oder DHL, Abholung in Eschlikon ist nach Absprache möglich.",
  },
  {
    q: "Kann ich nur ein einzelnes Bauteil bestellen?",
    a: "Ja. Wir drucken ab 1 Stück, es gibt keine Mindestbestellmenge.",
  },
  {
    q: "Wie schnell liefert 3DMuscio?",
    a: "Die Standard-Produktionszeit beträgt 48 Stunden ab Auftragsbestätigung, danach 1–2 Tage Versand innerhalb der Schweiz.",
  },
  {
    q: "Kann ich eine STL-Datei hochladen?",
    a: "Ja. Im Online-Kalkulator kannst du STL, STEP, 3MF oder OBJ hochladen und siehst den Preis direkt.",
  },
  {
    q: "Was ist der Unterschied zwischen FDM und SLA?",
    a: "FDM liefert belastbare Teile aus PLA, PETG, ABS, ASA oder TPU. SLA/Resin liefert feinere Details und glattere Oberflächen, ist aber spröder. Wir bieten beide Verfahren aus einer Hand.",
  },
  {
    q: "Welche Materialien sind verfügbar?",
    a: "Für FDM: PLA, PETG, ABS, ASA, TPU und Nylon. Für SLA: Resin. Die verfügbaren Farben sind auf den Materialseiten und im Kalkulator ersichtlich.",
  },
  {
    q: "Was kostet ein 3D-Druck?",
    a: "Der Preis richtet sich nach Materialverbrauch, Druckzeit, Qualitätsstufe und Nachbearbeitung. Im Kalkulator siehst du den Preis für dein Bauteil sofort und ohne Anmeldung.",
  },
  {
    q: "Arbeitet 3DMuscio auch mit Firmen?",
    a: "Ja. Für Firmenkunden stellen wir eine Schweizer QR-Rechnung aus; Karte, TWINT und Apple Pay sind ebenfalls möglich.",
  },
];

const TITLE = "3D-Druck Schweiz – FDM & SLA Druckservice ab 1 Stück | 3DMuscio";
const DESCRIPTION =
  "3D-Druckservice aus der Schweiz: FDM und SLA/Resin aus einer Hand, ab 1 Stück, Sofortpreis im Kalkulator, Produktion in Eschlikon TG, Versand schweizweit.";

export default function DruckSchweizPage() {
  return (
    <>
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          localBusinessJsonLd,
          serviceJsonLd("3D-Druckservice Schweiz", DESCRIPTION, PATH),
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "3D-Druck Schweiz", path: PATH },
          ]),
          faqJsonLd(faqs),
        ]}
      />
      <AnswerLanding
        eyebrow="Überblick"
        h1="3D-Druck Schweiz – FDM & SLA aus einer Hand"
        shortAnswer="3DMuscio ist ein Schweizer 3D-Druckservice mit Sitz in Eschlikon im Kanton Thurgau. Wir drucken Einzelteile, Prototypen, Funktionsteile, Ersatzteile und Kleinserien im FDM- und im SLA/Resin-Verfahren – ab 1 Stück, mit Sofortpreis im Online-Kalkulator und einer Standard-Produktionszeit von 48 Stunden ab Auftragsbestätigung."
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "3D-Druck Schweiz", to: PATH },
        ]}
        sections={[
          {
            title: "Für wen wir drucken",
            bullets: [
              "Privatkunden mit einem einzelnen Bauteil oder Modell",
              "Entwickler und Designer, die Prototypen testen",
              "Startups auf dem Weg zur ersten Kleinserie",
              "Unternehmen mit Ersatzteil-, Vorrichtungs- und Serienbedarf (Rechnung möglich)",
            ],
          },
          {
            title: "Unsere Verfahren",
            text: "FDM und SLA ergänzen sich: FDM für belastbare Teile, SLA für feine Details. Weil wir beide Verfahren anbieten, wählen wir für dein Bauteil das passende – ohne dass du zwei Anbieter brauchst.",
            bullets: [
              "FDM 3D-Druck: PLA, PETG, ABS, ASA, TPU, Nylon – typische Genauigkeit ±0.2 mm",
              "SLA / Resin 3D-Druck: feine Details, glatte Oberflächen, kaum sichtbare Schichten",
            ],
          },
          {
            title: "Was wir fertigen",
            bullets: [
              "Prototypen und Designmodelle",
              "Funktionsteile, Gehäuse, Halterungen",
              "Ersatzteile, die es nicht mehr gibt",
              "Kleinserien ohne Werkzeug- und Formkosten",
              "Vorrichtungen, Lehren und Montagehilfen",
            ],
          },
          {
            title: "So läuft eine Bestellung ab",
            text: "1. Datei (STL, STEP, 3MF oder OBJ) im Kalkulator hochladen. 2. Material, Farbe und Qualität wählen. 3. Preis sofort sehen und bestellen. 4. Produktion in Eschlikon TG, danach Versand schweizweit oder Abholung nach Absprache. Bei unklaren Bauteilen melden wir uns vor dem Druck persönlich.",
          },
          {
            title: "Warum Produktion in der Schweiz",
            text: "Kurze Wege, kurze Kommunikationswege und keine Zollabwicklung: Du sprichst direkt mit der Person, die dein Teil druckt, und erhältst es in der Regel innerhalb weniger Tage.",
          },
        ]}
        table={{
          title: "FDM oder SLA – welches Verfahren passt?",
          headers: ["Kriterium", "FDM", "SLA / Resin"],
          rows: [
            ["Stärke", "Belastbare Funktionsteile", "Feine Details, glatte Flächen"],
            ["Typische Genauigkeit", "±0.2 mm", "Feinere Details als FDM"],
            ["Sichtbare Schichten", "Sichtbar", "Kaum sichtbar"],
            ["Materialien", "PLA, PETG, ABS, ASA, TPU, Nylon", "Resin"],
            ["Mechanische Belastung", "Gut, materialabhängig", "Hart, aber spröder"],
            ["Typische Einsätze", "Ersatzteile, Gehäuse, Kleinserien", "Miniaturen, Modelle, Sichtteile"],
          ],
        }}
        faqs={faqs}
        related={[
          { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck", text: "Belastbare Funktionsteile und Gehäuse." },
          { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck", text: "Feine Details und glatte Oberflächen." },
          { label: "3D-Druck Prototypen", to: "/leistungen/3d-druck-prototypen", text: "Ideen in Tagen statt Wochen testen." },
          { label: "3D-Druck Kleinserien", to: "/leistungen/3d-druck-kleinserien", text: "Serienteile ohne Werkzeugkosten." },
          { label: "3D-Druck Ersatzteile", to: "/leistungen/3d-druck-ersatzteile", text: "Nachfertigen statt neu kaufen." },
          { label: "B2B 3D-Druck", to: "/leistungen/b2b-3d-druck", text: "Firmenkunden, Rechnung, Kleinserien." },
          { label: "Materialien", to: "/materialien", text: "PLA, PETG, ABS, ASA, TPU, Resin im Überblick." },
          { label: "3D-Druck Kosten Schweiz", to: "/wissen/3d-druck-kosten-schweiz", text: "Woraus sich der Preis zusammensetzt." },
          { label: "Preis berechnen", to: "/kalkulator-online", text: "Datei hochladen, Preis sofort sehen." },
        ]}
      />
    </>
  );
}
