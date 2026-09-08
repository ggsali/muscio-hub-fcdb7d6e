/**
 * Inhalte der regionalen Landingpages (/3d-druck-<region>).
 *
 * Grundregeln:
 * - Produktionsstandort ist ausschliesslich Eschlikon TG. Keine Seite behauptet
 *   einen Standort in Zürich, Winterthur oder St. Gallen.
 * - Jede Seite hat ein eigenes primäres Thema, eigene Abschnitte und eigene FAQ,
 *   damit kein Duplicate Content und keine Kannibalisierung entsteht.
 * - Alle Angaben stammen aus bestehenden Website-Inhalten (src/data/company.ts).
 */

import type { AnswerFaq, AnswerSection, RelatedLink } from "@/components/site/AnswerLanding";

export interface RegionContent {
  /** Route-Slug ohne Schrägstrich, z. B. "3d-druck-zuerich" */
  slug: string;
  /** Name der Region für Breadcrumb, Schema und Texte */
  region: string;
  /** Schema.org-Typ des Gebiets */
  areaType: "AdministrativeArea" | "City" | "Country";
  eyebrow: string;
  h1: string;
  title: string;
  description: string;
  /** Zitierfähige Direktantwort für AI-Suche (2–4 Sätze) */
  shortAnswer: string;
  sections: AnswerSection[];
  faqs: AnswerFaq[];
  related: RelatedLink[];
  ctaTitle: string;
}

const leistungsLinks: RelatedLink[] = [
  { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck", text: "Belastbare Funktionsteile, Gehäuse, Halterungen." },
  { label: "SLA Resin 3D-Druck", to: "/leistungen/sla-3d-druck", text: "Feine Details und glatte Oberflächen." },
  { label: "Preis berechnen", to: "/kalkulator-online", text: "Datei hochladen, Sofortpreis sehen." },
];

export const regionen: RegionContent[] = [
  {
    slug: "3d-druck-thurgau",
    region: "Thurgau",
    areaType: "AdministrativeArea",
    eyebrow: "Produktionsstandort",
    h1: "3D-Druck Thurgau – Produktion in Eschlikon TG",
    title: "3D-Druck Thurgau – Druckerei in Eschlikon TG | 3DMuscio",
    description:
      "3D-Druck im Thurgau: 3DMuscio produziert in Eschlikon TG. FDM und SLA, ab 1 Stück, Abholung vor Ort oder Versand. Sofortpreis im Online-Kalkulator.",
    shortAnswer:
      "3D-Druck im Thurgau kommt bei 3DMuscio direkt aus der eigenen Werkstatt an der Gartensiedlung 13 in 8360 Eschlikon TG. Der Thurgau ist damit kein Liefergebiet, sondern der Produktionsstandort: Teile können nach Absprache vor Ort abgeholt werden. Gedruckt wird in FDM und SLA/Resin, ab 1 Stück und ohne Mindestbestellmenge.",
    sections: [
      {
        title: "Warum diese Seite der Standort ist",
        text: "Alle Drucker von 3DMuscio stehen in Eschlikon im Kanton Thurgau. Was auf den anderen Regionsseiten als Liefergebiet beschrieben wird, ist hier die Werkstatt selbst: Aufträge aus dem Thurgau gehen ohne Versandweg direkt in die Produktion und können nach Fertigstellung abgeholt werden.",
      },
      {
        title: "Abholung in Eschlikon",
        bullets: [
          "Adresse: Gartensiedlung 13, 8360 Eschlikon TG",
          "Abholung nach Absprache per E-Mail oder Telefon",
          "Kein Versand, keine Versandkosten, kein Wartetag",
          "Rückfragen zur Druckbarkeit direkt vor Ort klärbar",
        ],
      },
      {
        title: "Typische Thurgauer Aufträge",
        bullets: [
          "Ersatzteile für Landwirtschaft, Haushalt und Werkstatt",
          "Halterungen und Vorrichtungen für Produktionslinien",
          "Prototypen für KMU und Startups aus der Region",
          "Kleinserien für regionale Produkte, mit QR-Rechnung",
        ],
      },
      {
        title: "Ablauf",
        text: "Datei (STL, STEP, 3MF oder OBJ) im Online-Kalkulator hochladen, Material und Qualität wählen und den Preis sofort sehen. Ohne Datei geht es über das Kontaktformular mit Fotos und Massen. Standard-Produktionszeit sind 48 Stunden ab Auftragsbestätigung.",
      },
    ],
    faqs: [
      { q: "Wo genau produziert 3DMuscio im Thurgau?", a: "An der Gartensiedlung 13 in 8360 Eschlikon TG. Das ist der einzige Produktionsstandort von 3DMuscio." },
      { q: "Kann ich meine Teile in Eschlikon abholen?", a: "Ja. Abholung ist nach Absprache möglich – wir melden uns, sobald die Teile fertig sind, und stimmen einen Zeitpunkt ab." },
      { q: "Lohnt sich die Abholung auch für ein einzelnes Kleinteil?", a: "Ja, du sparst Versandkosten und mindestens einen Tag Wartezeit. Bei Eilaufträgen aus der Region ist die Abholung der schnellste Weg zum Teil." },
      { q: "Druckt 3DMuscio auch für Thurgauer Firmen?", a: "Ja. Für Firmenkunden stellen wir eine Schweizer QR-Rechnung aus, von Einzelteilen bis zu Kleinserien." },
    ],
    related: [
      ...leistungsLinks,
      { label: "3D-Druck Ostschweiz", to: "/3d-druck-ostschweiz", text: "Übersicht über die Ostschweizer Kantone." },
      { label: "Über uns", to: "/ueber-uns", text: "Wer hinter 3DMuscio steht." },
    ],
    ctaTitle: "3D-Druck im Thurgau anfragen",
  },
  {
    slug: "3d-druck-ostschweiz",
    region: "Ostschweiz",
    areaType: "AdministrativeArea",
    eyebrow: "Regionale Übersicht",
    h1: "3D-Druck Ostschweiz – Übersicht der Regionen",
    title: "3D-Druck Ostschweiz – Druckservice aus dem Thurgau | 3DMuscio",
    description:
      "3D-Druck Ostschweiz: Produktion in Eschlikon TG, Lieferung nach St. Gallen, Winterthur, Appenzell, Glarus. FDM und SLA ab 1 Stück, Sofortpreis online.",
    shortAnswer:
      "3D-Druck in der Ostschweiz bietet 3DMuscio von Eschlikon TG aus an. Diese Seite ist die regionale Übersicht: von hier führen die Wege zu den einzelnen Zielregionen Thurgau, St. Gallen, Winterthur und Zürich. Beliefert werden Thurgau, St. Gallen, Appenzell, Glarus und das Zürcher Oberland – in der Regel 1 Tag Versand nach 48 Stunden Produktionszeit.",
    sections: [
      {
        title: "Die Ostschweiz auf einen Blick",
        text: "Der Produktionsstandort Eschlikon TG liegt mitten in der Ostschweiz. Dadurch sind die Transportwege innerhalb der Region kurz: nach der Produktion ist ein Paket meist am nächsten Werktag beim Kunden. Für jede Zielregion gibt es eine eigene Seite mit den Details.",
      },
      {
        title: "Regionen im Detail",
        bullets: [
          "Thurgau: Produktionsstandort mit Abholung in Eschlikon",
          "St. Gallen: Versand oder Abholung, rund 40 km entfernt",
          "Winterthur: nächstgelegene Grossstadt, rund 25 km entfernt",
          "Zürich: rein online abgewickelt, Versand mit Post oder DHL",
        ],
      },
      {
        title: "Was in der Ostschweiz gedruckt wird",
        bullets: [
          "Ersatzteile für Industrie, Gewerbe und Landwirtschaft",
          "Prototypen für Maschinenbau und Produktentwicklung",
          "Kleinserien ohne Werkzeugkosten",
          "Modelle und Sichtteile in SLA/Resin",
        ],
      },
      {
        title: "Abwicklung",
        text: "Der ganze Ablauf läuft online: Datei hochladen, Material und Qualität wählen, Preis sofort sehen, bestellen. Bezahlt wird per Karte, TWINT, Apple Pay oder – für Firmen – per Schweizer QR-Rechnung.",
      },
    ],
    faqs: [
      { q: "Welche Kantone deckt 3DMuscio in der Ostschweiz ab?", a: "Thurgau, St. Gallen, Appenzell Innerrhoden und Ausserrhoden, Glarus sowie das Zürcher Oberland. Der Versand innerhalb dieser Region dauert nach der Produktion meist 1 Tag." },
      { q: "Wo produziert 3DMuscio?", a: "Ausschliesslich in Eschlikon im Kanton Thurgau. In den übrigen Ostschweizer Regionen gibt es keine Standorte – dort liefern wir per Post oder DHL." },
      { q: "Welche Seite ist für meine Region die richtige?", a: "Für den Thurgau die Standortseite, für St. Gallen, Winterthur und Zürich die jeweilige Regionsseite. Diese Seite gibt den Überblick über alle." },
      { q: "Gibt es Express-Produktion?", a: "Bei dringenden Aufträgen prüfen wir individuell, ob eine schnellere Produktion oder ein Express-Versand möglich ist. Vermerke das einfach in der Anfrage." },
    ],
    related: [
      { label: "3D-Druck Thurgau", to: "/3d-druck-thurgau", text: "Produktionsstandort Eschlikon TG." },
      { label: "3D-Druck St. Gallen", to: "/3d-druck-st-gallen", text: "Lieferung in die Region St. Gallen." },
      { label: "3D-Druck Winterthur", to: "/3d-druck-winterthur", text: "Nächstgelegene Grossstadt." },
      { label: "3D-Druck Zürich", to: "/3d-druck-zuerich", text: "Online bestellen, Versand nach Zürich." },
      ...leistungsLinks,
    ],
    ctaTitle: "3D-Druck in der Ostschweiz anfragen",
  },
  {
    slug: "3d-druck-st-gallen",
    region: "St. Gallen",
    areaType: "AdministrativeArea",
    eyebrow: "Zielregion",
    h1: "3D-Druck St. Gallen – Teile drucken lassen",
    title: "3D-Druck St. Gallen – Teile drucken lassen | 3DMuscio",
    description:
      "3D-Druck für St. Gallen: 3DMuscio druckt in Eschlikon TG, rund 40 km entfernt. FDM und SLA ab 1 Stück, Versand oder Abholung, Sofortpreis online.",
    shortAnswer:
      "Wer in St. Gallen ein Teil 3D drucken lassen will, bestellt bei 3DMuscio online: gedruckt wird in Eschlikon TG, rund 40 Kilometer entfernt. Nach 48 Stunden Produktionszeit ist ein Paket in der Region St. Gallen üblicherweise am nächsten Werktag zugestellt; Abholung in Eschlikon ist nach Absprache möglich.",
    sections: [
      {
        title: "Kurze Distanz, kurze Wege",
        text: "Zwischen Eschlikon und der Stadt St. Gallen liegen rund 40 Kilometer. Das heisst: schneller Versand und – anders als bei weiter entfernten Regionen – eine realistische Abholoption, wenn ein Teil dringend gebraucht wird.",
      },
      {
        title: "Häufig gefragt in der Region St. Gallen",
        bullets: [
          "Ersatzteile für Maschinen, wenn das Original nicht mehr lieferbar ist",
          "Prototypen für Industrie- und Textilprojekte",
          "Vorrichtungen und Lehren für die Fertigung",
          "Kleinserien ab 1 Stück, mit Mengenrabatt ab 5 bzw. 10 Stück",
        ],
      },
      {
        title: "Verfahren wählen",
        text: "FDM eignet sich für belastbare Funktionsteile aus PLA, PETG, ABS, ASA oder TPU. SLA/Resin liefert feinere Details und glattere Oberflächen für Modelle und Sichtteile. Beide Verfahren kommen aus derselben Werkstatt – ein Auftrag kann Teile aus beiden enthalten.",
      },
    ],
    faqs: [
      { q: "Wo kann ich in St. Gallen ein Ersatzteil 3D drucken lassen?", a: "Bei 3DMuscio. Die Bestellung läuft online, gedruckt wird in Eschlikon TG, geliefert wird nach St. Gallen per Post oder DHL – oder du holst das Teil in Eschlikon ab." },
      { q: "Hat 3DMuscio eine Werkstatt in St. Gallen?", a: "Nein. Der einzige Produktionsstandort ist Eschlikon im Kanton Thurgau, rund 40 km von St. Gallen entfernt." },
      { q: "Wie schnell ist mein Teil in St. Gallen?", a: "Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung, danach in der Regel 1 Tag Versand innerhalb der Ostschweiz." },
      { q: "Brauche ich eine 3D-Datei?", a: "Für den Sofortpreis ja – STL, STEP, 3MF oder OBJ. Ohne Datei schickst du Fotos und Masse über das Kontaktformular, und wir melden uns mit einer Einschätzung." },
    ],
    related: [
      { label: "3D-Druck Ostschweiz", to: "/3d-druck-ostschweiz", text: "Übersicht der Ostschweizer Regionen." },
      { label: "3D-Druck Thurgau", to: "/3d-druck-thurgau", text: "Produktionsstandort mit Abholung." },
      { label: "3D-Druck Ersatzteile", to: "/leistungen/3d-druck-ersatzteile", text: "Nicht mehr erhältliche Teile nachdrucken." },
      ...leistungsLinks,
    ],
    ctaTitle: "3D-Druck für St. Gallen anfragen",
  },
  {
    slug: "3d-druck-winterthur",
    region: "Winterthur",
    areaType: "City",
    eyebrow: "Zielregion",
    h1: "3D-Druck Winterthur – Teile bestellen",
    title: "3D-Druck Winterthur – Teile online bestellen | 3DMuscio",
    description:
      "3D-Druck für Winterthur: Produktion in Eschlikon TG, rund 25 km entfernt. FDM und SLA ab 1 Stück, Sofortpreis im Kalkulator, Versand oder Abholung.",
    shortAnswer:
      "Für Winterthur druckt 3DMuscio in Eschlikon TG – mit rund 25 Kilometern die kürzeste Distanz aller Zielregionen. Bestellt wird online über den Kalkulator; nach 48 Stunden Produktionszeit folgt der Versand, oder du holst die Teile in Eschlikon ab. Gedruckt wird in FDM und SLA/Resin, ab 1 Stück.",
    sections: [
      {
        title: "Die nächstgelegene Stadt",
        text: "Winterthur ist von Eschlikon aus rund 25 Kilometer entfernt und damit die Grossstadt mit dem kürzesten Weg zur Produktion. Für Aufträge, die schnell fertig sein müssen, ist die Abholung deshalb hier besonders praktisch.",
      },
      {
        title: "Wofür Winterthurer Kunden drucken lassen",
        bullets: [
          "Prototypen für Technik- und Designprojekte",
          "Ersatzteile für Geräte, Velos und Haushalt",
          "Funktionsteile und Gehäuse aus PETG oder ABS",
          "Modelle und Sichtteile in SLA/Resin",
        ],
      },
      {
        title: "Vom Upload zum Teil",
        text: "Datei hochladen, Material und Qualität wählen, Preis sehen, bestellen – ohne Anmeldung und ohne Angebotswartezeit. Bezahlt wird per Karte, TWINT oder Apple Pay; Firmen erhalten eine Schweizer QR-Rechnung.",
      },
    ],
    faqs: [
      { q: "Wo kann ich in Winterthur ein 3D-Druckteil bestellen?", a: "Online bei 3DMuscio: Datei im Kalkulator hochladen, Preis sofort sehen, bestellen. Gedruckt wird in Eschlikon TG, rund 25 km von Winterthur." },
      { q: "Gibt es einen 3D-Drucker-Shop in Winterthur?", a: "3DMuscio hat in Winterthur keinen Standort. Die Produktion findet in Eschlikon im Thurgau statt, Lieferung erfolgt per Post oder DHL." },
      { q: "Kann ich in Eschlikon abholen, wenn ich in Winterthur wohne?", a: "Ja, das ist die schnellste Variante – rund 25 km Fahrweg. Abholung stimmen wir nach der Produktion kurz ab." },
      { q: "Wie lange dauert es insgesamt?", a: "48 Stunden Produktionszeit ab Auftragsbestätigung plus 1 Tag Versand; bei Abholung entfällt der Versandtag." },
    ],
    related: [
      { label: "3D-Druck Zürich", to: "/3d-druck-zuerich", text: "Region Zürich, online abgewickelt." },
      { label: "3D-Druck Ostschweiz", to: "/3d-druck-ostschweiz", text: "Übersicht der Regionen." },
      { label: "3D-Druck Prototypen", to: "/leistungen/3d-druck-prototypen", text: "Von der Idee zum Testteil." },
      ...leistungsLinks,
    ],
    ctaTitle: "3D-Druck für Winterthur anfragen",
  },
  {
    slug: "3d-druck-zuerich",
    region: "Zürich",
    areaType: "AdministrativeArea",
    eyebrow: "Zielregion",
    h1: "3D-Druck Zürich – online bestellen, geliefert nach Zürich",
    title: "3D-Druck Zürich – online bestellen und liefern lassen | 3DMuscio",
    description:
      "3D-Druck für Zürich: online bestellen, Produktion in Eschlikon TG, Lieferung mit Post oder DHL. FDM und SLA ab 1 Stück, Sofortpreis ohne Anmeldung.",
    shortAnswer:
      "3D-Druck für Zürich läuft bei 3DMuscio vollständig online: Datei hochladen, Sofortpreis sehen, bestellen. Produziert wird in Eschlikon TG, geliefert wird nach Zürich mit Post oder DHL – meist 3 bis 4 Tage von Upload bis Zustellung. Einen Standort in Zürich hat 3DMuscio nicht.",
    sections: [
      {
        title: "Ohne Termin, ohne Weg",
        text: "In Zürich gibt es keine Filiale von 3DMuscio – und für die meisten Aufträge braucht es sie auch nicht. Der Kalkulator ersetzt das Angebot: Datei hochladen, Material und Qualität wählen, Preis sehen. Rückfragen klären wir per E-Mail oder Telefon.",
      },
      {
        title: "Häufige Aufträge aus der Region Zürich",
        bullets: [
          "Prototypen für Startups und Produktentwicklung",
          "Designmodelle und Sichtteile in SLA/Resin",
          "Ersatzteile für Möbel, Geräte und Technik",
          "Kleinserien ohne Werkzeug- und Formkosten",
        ],
      },
      {
        title: "Lieferung nach Zürich",
        text: "Nach 48 Stunden Produktionszeit geht das Paket mit Post oder DHL raus und ist üblicherweise innerhalb von 1 bis 2 Tagen in Zürich. Abholung in Eschlikon TG ist möglich, aber für Zürich meist nicht der schnellste Weg.",
      },
    ],
    faqs: [
      { q: "Wer bietet 3D-Druck in Zürich an?", a: "3DMuscio nimmt Aufträge aus Zürich online an und produziert in Eschlikon TG. Die Teile werden mit Post oder DHL nach Zürich geliefert." },
      { q: "Hat 3DMuscio einen Standort in Zürich?", a: "Nein. Der Produktionsstandort ist Eschlikon im Kanton Thurgau. Für Zürich läuft die Abwicklung online plus Versand." },
      { q: "Wie schnell ist mein Teil in Zürich?", a: "48 Stunden Produktionszeit ab Auftragsbestätigung, danach 1 bis 2 Tage Versand – insgesamt meist 3 bis 4 Tage." },
      { q: "Muss ich für ein Angebot vorbeikommen?", a: "Nein. Der Preis steht direkt im Online-Kalkulator, ohne Anmeldung und ohne Wartezeit." },
    ],
    related: [
      { label: "3D-Druck Winterthur", to: "/3d-druck-winterthur", text: "Kürzester Weg zur Produktion." },
      { label: "3D-Druck Schweiz", to: "/3d-druck-schweiz", text: "Nationale Übersicht zum Druckservice." },
      { label: "3D-Druck Kleinserien", to: "/leistungen/3d-druck-kleinserien", text: "Serien ohne Werkzeugkosten." },
      ...leistungsLinks,
    ],
    ctaTitle: "3D-Druck für Zürich anfragen",
  },
];

export const regionBySlug = (slug: string) => regionen.find((r) => r.slug === slug);
