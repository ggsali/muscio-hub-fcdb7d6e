import type { AnswerFaq, AnswerSection, RelatedLink } from "@/components/site/AnswerLanding";

export interface LocationContent {
  slug: string;
  region: string;
  h1: string;
  title: string;
  description: string;
  shortAnswer: string;
  sections: AnswerSection[];
  faqs: AnswerFaq[];
  related: RelatedLink[];
}

const commonFaqs: AnswerFaq[] = [
  { q: "Wie lange dauert die Lieferung?", a: "Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung, danach Versand mit Post oder DHL (1–2 Tage innerhalb der Schweiz)." },
  { q: "Kann ich meine Teile abholen?", a: "Ja, Abholung ist am Standort Gartensiedlung 13, 8360 Eschlikon TG nach Absprache möglich." },
  { q: "Welche Dateiformate nehmt ihr an?", a: "STL, STEP, 3MF und OBJ – direkt im Online-Kalkulator hochladen." },
];

const thurgauFaqs: AnswerFaq[] = [
  { q: "Wo genau in Eschlikon kann ich abholen?", a: "Unsere Werkstatt ist an der Gartensiedlung 13 in 8360 Eschlikon TG. Abholung stimmen wir nach Produktion kurz per E-Mail oder Telefon ab." },
  { q: "Lohnt sich Abholung auch für kleine Teile?", a: "Ja – du sparst Versandkosten und Wartezeit. Gerade bei Eilaufträgen ist die Abholung in Eschlikon der schnellste Weg zum fertigen Teil." },
  { q: "Druckt ihr auch für Firmen im Thurgau?", a: "Ja, wir beliefern KMU, Landwirtschaft, Handwerk und Startups in der ganzen Region – von Einzelteilen bis zu Kleinserien mit Rechnung." },
  ...commonFaqs,
];

const ostschweizFaqs: AnswerFaq[] = [
  { q: "Liefert ihr in alle Ostschweizer Kantone?", a: "Ja – Thurgau, St. Gallen, Appenzell Innerrhoden und Ausserrhoden, Glarus und das Zürcher Oberland beliefern wir per Post oder DHL in 1–2 Tagen nach Produktion." },
  { q: "Gibt es einen Express-Versand?", a: "Bei dringenden Aufträgen klären wir individuell, ob eine schnellere Produktion oder ein Express-Versand möglich ist – schreibe uns dazu einfach bei der Anfrage." },
  ...commonFaqs,
];

const zuerichFaqs: AnswerFaq[] = [
  { q: "Wie schnell ist mein Teil in Zürich?", a: "Nach Auftragsbestätigung produzieren wir im Standard innert 48 Stunden; der Versand nach Zürich dauert in der Regel 1–2 Tage. Insgesamt also meist 3–4 Tage von Upload bis Zustellung." },
  { q: "Muss ich für ein Angebot vorbeikommen?", a: "Nein – der ganze Prozess läuft online: Datei hochladen, Preis sehen, bestellen. Bei Rückfragen melden wir uns telefonisch oder per E-Mail." },
  ...commonFaqs,
];

const stGallenFaqs: AnswerFaq[] = [
  { q: "Wie weit ist Eschlikon von St. Gallen?", a: "Rund 40 Kilometer – Abholung ist nach Absprache möglich, der Versand in die Region St. Gallen dauert nach der Produktion üblicherweise nur 1 Tag." },
  { q: "Könnt ihr kurzfristige Ersatzteile liefern?", a: "Häufig ja. Wenn ein Teil dringend ist, markiere die Anfrage entsprechend – wir priorisieren nach Möglichkeit." },
  ...commonFaqs,
];

const commonRelated: RelatedLink[] = [
  { label: "Preis online berechnen", to: "/kalkulator-online", text: "Datei hochladen und Preis sehen." },
  { label: "Leistungen", to: "/leistungen", text: "FDM, SLA, Prototypen, Ersatzteile, Kleinserien." },
  { label: "Materialien", to: "/materialien", text: "PLA, PETG, ABS, ASA, TPU, Resin." },
];

export const locations: LocationContent[] = [
  {
    slug: "thurgau",
    region: "Thurgau",
    h1: "3D-Druck Thurgau – dein Druckservice in Eschlikon",
    title: "3D-Druck Thurgau | Druckservice in Eschlikon TG | 3DMuscio",
    description:
      "3D-Druckservice im Thurgau: 3DMuscio in Eschlikon druckt Prototypen, Ersatzteile und Kleinserien in FDM und SLA. Abholung vor Ort oder Versand.",
    shortAnswer:
      "3DMuscio ist ein 3D-Druckservice mit Werkstatt in Eschlikon TG – mitten im Thurgau. Kundinnen und Kunden aus der Region können Teile direkt vor Ort abholen oder sich schweizweit zusenden lassen. Gedruckt wird in FDM und SLA, ab 1 Stück und ohne Mindestbestellmenge.",
    sections: [
      {
        title: "Vor Ort in Eschlikon",
        text: "Unsere Produktion steht an der Gartensiedlung 13 in 8360 Eschlikon TG. Wer in der Region wohnt oder arbeitet, spart damit Versandzeit: Teile können nach Absprache direkt abgeholt werden. Für grössere Projekte lässt sich vorab telefonisch oder per E-Mail klären, ob und wie ein Bauteil sinnvoll druckbar ist.",
      },
      {
        title: "Typische Aufträge aus dem Thurgau",
        bullets: [
          "Ersatzteile für Haushalt, Landwirtschaft und Werkstatt",
          "Prototypen für lokale KMU und Startups",
          "Halterungen und Vorrichtungen für die Produktion",
          "Kleinserien für regionale Produkte",
        ],
      },
      {
        title: "So läuft eine Anfrage ab",
        text: "Datei im Online-Kalkulator hochladen, Material und Qualität wählen und den Preis direkt sehen. Ohne Datei geht es über das Kontaktformular mit Fotos und Maßen. Nach Auftragsbestätigung produzieren wir im Standard innerhalb von 48 Stunden.",
      },
      {
        title: "Wirtschaftsfaktor Region",
        text: "Der Thurgau ist ein Industrie- und Landwirtschaftskanton – entsprechend vielfältig sind die Anfragen: von Halterungen für die Obstverarbeitung über Vorrichtungen für Metallbaubetriebe bis zu Gehäusen für lokale Elektronikprodukte. Weil wir selbst hier produzieren, verstehen wir die Anforderungen der regionalen Betriebe und können kurzfristig reagieren.",
      },
      {
        title: "Entfernungen im Kanton",
        bullets: [
          "Frauenfeld, Weinfelden, Kreuzlingen: Versand meist 1 Tag nach Produktion",
          "Amriswil, Romanshorn, Arbon: Versand 1–2 Tage, Abholung in ca. 20 Min. erreichbar",
          "Wil, Münchwilen, Sirnach: direkte Nachbarschaft – Abholung in wenigen Minuten",
        ],
      },
    ],
    faqs: thurgauFaqs,
    related: commonRelated,
  },
  {
    slug: "ostschweiz",
    region: "Ostschweiz",
    h1: "3D-Druck Ostschweiz – Prototypen, Ersatzteile, Kleinserien",
    title: "3D-Druck Ostschweiz | FDM & SLA Druckservice | 3DMuscio",
    description:
      "3D-Druckservice für die Ostschweiz: FDM und SLA aus Eschlikon TG. Prototypen, Ersatzteile und Kleinserien ab 1 Stück, 48 h Produktionszeit.",
    shortAnswer:
      "Für die Ostschweiz produzieren wir aus Eschlikon TG heraus: Prototypen, Funktionsteile, Ersatzteile und Kleinserien in FDM und SLA. Dank kurzer Wege innerhalb der Region sind Teile nach der Produktion schnell da – oder du holst sie direkt ab.",
    sections: [
      {
        title: "Kurze Wege in der Region",
        text: "Aus Eschlikon liegen Thurgau, St. Gallen, Appenzell und das Zürcher Oberland in unmittelbarer Nachbarschaft. Versand innerhalb der Schweiz dauert nach der Produktion in der Regel 1–2 Tage; Abholung in Eschlikon ist nach Absprache jederzeit möglich.",
      },
      {
        title: "Für Unternehmen und Privatpersonen",
        bullets: [
          "KMU: Vorrichtungen, Ersatzteile, Serienzubehör",
          "Startups: Prototypen und Nullserien",
          "Handwerk: Sonderteile und Adapter",
          "Privat: Reparaturteile und Modelle",
        ],
      },
      {
        title: "Fertigung in der Schweiz",
        text: "Alle Teile entstehen in unserer Werkstatt in Eschlikon TG – kein Import, keine Zollabwicklung, kein Warten auf Sendungen aus dem Ausland. Bei Rückfragen sprichst du direkt mit der Person, die dein Teil druckt.",
      },
      {
        title: "Warum die Ostschweiz für den 3D-Druck ideal ist",
        text: "Die Region hat eine starke industrielle Basis – von Textilmaschinen über Lebensmitteltechnik bis zum Apparatebau. Genau diese Betriebe brauchen schnell verfügbare Ersatzteile, Vorrichtungen und Prototypen in kleinen Stückzahlen. Statt wochenlang auf Zulieferer zu warten, liefern wir nach Auftragsbestätigung innert weniger Tage.",
      },
    ],
    faqs: ostschweizFaqs,
    related: commonRelated,
  },
  {
    slug: "zuerich",
    region: "Zürich",
    h1: "3D-Druck Zürich – Schweizer Druckservice mit Versand",
    title: "3D-Druck Zürich | Druckservice mit Versand | 3DMuscio",
    description:
      "3D-Druckservice für Zürich: Prototypen, Ersatzteile und Kleinserien aus Eschlikon TG. Online kalkulieren, 48 h Produktion, Versand in 1–2 Tagen.",
    shortAnswer:
      "Für Kundschaft in Zürich produzieren wir in Eschlikon TG und versenden mit Post oder DHL – nach der Standard-Produktionszeit von 48 Stunden ist das Paket in der Regel innerhalb von 1–2 Tagen da. Der komplette Ablauf von Upload bis Bestellung läuft online, ohne Termin.",
    sections: [
      {
        title: "Komplett online abwickeln",
        text: "Datei hochladen, Material und Qualität wählen, Preis sehen, bestellen. Du brauchst keinen Vor-Ort-Termin und keine Anmeldung, um den Preis zu berechnen. Bei Fragen zur Konstruktion oder Materialwahl melden wir uns vor dem Druck.",
      },
      {
        title: "Was wir für Zürcher Kundschaft drucken",
        bullets: [
          "Prototypen für Produktentwicklung",
          "Funktions- und Ersatzteile",
          "Architektur- und Präsentationsmodelle",
          "Kleinserien ohne Formkosten",
        ],
      },
      {
        title: "Warum Schweizer Fertigung",
        text: "Kurze Lieferwege, Ansprechperson in derselben Zeitzone und Sprache, keine Zollformalitäten. Bei Reklamationen oder Änderungswünschen entfällt der Umweg über einen Auslandsanbieter.",
      },
      {
        title: "Für Startups und Industrie in Zürich",
        text: "Zürich ist eine der dichtesten Startup- und Industrieregionen Europas. Wir unterstützen Entwicklungsteams mit schnellen Iterationen: heute hochgeladen, in wenigen Tagen das physische Teil in der Hand. Auch für etablierte Firmen drucken wir Vorrichtungen, Halterungen und Ersatzteile – ohne Mindestmenge und ohne lange Beschaffungswege.",
      },
    ],
    faqs: zuerichFaqs,
    related: commonRelated,
  },
  {
    slug: "st-gallen",
    region: "St. Gallen",
    h1: "3D-Druck St. Gallen – Fertigung in der Nachbarschaft",
    title: "3D-Druck St. Gallen | FDM & SLA Druckservice | 3DMuscio",
    description:
      "3D-Druckservice für St. Gallen: FDM und SLA aus Eschlikon TG. Prototypen, Ersatzteile, Kleinserien ab 1 Stück. Online kalkulieren, 48 h Produktion.",
    shortAnswer:
      "St. Gallen liegt nur wenige Kilometer von unserer Werkstatt in Eschlikon TG entfernt. Wir drucken Prototypen, Funktions- und Ersatzteile sowie Kleinserien in FDM und SLA – mit Versand oder Abholung nach Absprache.",
    sections: [
      {
        title: "Regional produziert",
        text: "Statt Teile im Ausland zu bestellen und auf den Versand zu warten, wird bei uns in der Ostschweiz gedruckt. Das verkürzt Iterationszyklen deutlich – gerade wenn eine zweite oder dritte Version eines Prototyps nötig ist.",
      },
      {
        title: "Typische Anwendungen",
        bullets: [
          "Prototypen und Funktionsmuster",
          "Ersatzteile für Maschinen und Geräte",
          "Vorrichtungen und Montagehilfen",
          "Modelle und Sichtteile in Resin",
        ],
      },
      {
        title: "Beratung vor dem Druck",
        text: "Wenn eine Geometrie kritisch ist – dünne Wände, enge Toleranzen, hohe Belastung – melden wir uns vor der Produktion mit einem Hinweis, statt ein Teil zu drucken, das später nicht funktioniert.",
      },
      {
        title: "Persönlich statt anonym",
        text: "Bei grossen Online-Druckplattformen weisst du nie, wer dein Teil produziert. Bei uns sprichst du mit der Person, die deine Datei prüft und den Druck überwacht – das macht Korrekturen und kurzfristige Änderungen deutlich einfacher.",
      },
    ],
    faqs: stGallenFaqs,
    related: commonRelated,
  },
];

export const getLocation = (slug?: string) => locations.find((l) => l.slug === slug);
