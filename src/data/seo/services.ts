import type { AnswerFaq, AnswerSection, RelatedLink } from "@/components/site/AnswerLanding";

export interface ServiceContent {
  slug: string;
  eyebrow: string;
  h1: string;
  title: string;
  description: string;
  shortAnswer: string;
  sections: AnswerSection[];
  faqs: AnswerFaq[];
  related: RelatedLink[];
}

export const services: ServiceContent[] = [
  {
    slug: "fdm-3d-druck",
    eyebrow: "Verfahren",
    h1: "FDM 3D-Druck – robuste Teile aus Kunststoff",
    title: "FDM 3D-Druck Schweiz | Funktionsteile & Gehäuse | 3DMuscio",
    description:
      "FDM 3D-Druck aus Eschlikon TG für Funktionsteile, Gehäuse und Halterungen: Schweizer 3D-Druckservice mit Sofortpreis, persönlichem Service und 48 h Produktion.",
    shortAnswer:
      "FDM (Fused Deposition Modeling) ist das richtige Verfahren, wenn ein Bauteil mechanisch belastbar, günstig und schnell sein soll. Ein Kunststofffaden wird geschmolzen und Schicht für Schicht aufgetragen. Bei 3DMuscio drucken wir FDM in PLA, PETG, ABS, ASA und TPU mit einer typischen Genauigkeit von ±0.2 mm.",
    sections: [
      {
        title: "Wofür sich FDM eignet",
        text: "FDM ist das Arbeitspferd im 3D-Druck. Es liefert die beste Kombination aus Festigkeit, Materialauswahl und Preis und ist deshalb für die meisten technischen Bauteile die erste Wahl.",
        bullets: [
          "Funktionsteile und Halterungen",
          "Gehäuse und Abdeckungen",
          "Ersatzteile für Maschinen und Haushalt",
          "Vorrichtungen, Lehren und Montagehilfen",
          "Prototypen mit realistischer Belastbarkeit",
          "Kleinserien ab 1 Stück",
        ],
      },
      {
        title: "Vorteile",
        bullets: [
          "Grosse Materialauswahl (PLA, PETG, ABS, ASA, TPU)",
          "Günstig auch bei grösseren Bauteilen",
          "Mechanisch belastbare Teile",
          "Temperatur- und UV-fähige Materialien verfügbar",
          "Kurze Durchlaufzeit – Standard 48 h ab Auftragsbestätigung",
        ],
      },
      {
        title: "Grenzen des Verfahrens",
        text: "FDM baut sichtbare Schichten auf. Sehr feine Details, dünne Stege unter etwa 1 mm oder spiegelglatte Sichtflächen erreicht das Verfahren nicht. Für solche Teile ist SLA/Resin besser geeignet. Ausserdem sind FDM-Teile in Z-Richtung (senkrecht zu den Schichten) etwas weniger belastbar – wir richten Bauteile deshalb passend zur Belastungsrichtung aus.",
      },
      {
        title: "Toleranzen und Oberflächen",
        text: "Die typische Genauigkeit liegt bei ±0.2 mm. Standard-Schichthöhe ist ein guter Kompromiss aus Zeit und Optik; feinere Schichten sind auf Wunsch möglich und werden im Kalkulator über die Qualitätsstufe abgebildet. Stützstrukturen entfernen wir und prüfen jedes Teil vor dem Versand von Hand.",
      },
      {
        title: "Dateien und Ablauf",
        text: "Lade STL, STEP, 3MF oder OBJ im Online-Kalkulator hoch. Du siehst Gewicht, Druckzeit und Preis direkt und kannst Material und Qualität wählen. Nach der Bestellung produzieren wir in Eschlikon TG und versenden schweizweit – oder du holst das Teil bei uns ab.",
      },
    ],
    faqs: [
      { q: "Welches FDM-Material ist am belastbarsten?", a: "Für hohe Festigkeit und Temperaturbeständigkeit sind ABS, ASA und Nylon geeignet. PETG ist der gute Allrounder für Funktionsteile, PLA eher für Modelle und Prototypen." },
      { q: "Sind FDM-Teile wasserdicht?", a: "Mit angepasster Wandstärke und Materialwahl (z. B. PETG) lassen sich weitgehend dichte Teile drucken. Absolute Dichtheit garantieren wir nicht – für kritische Anwendungen bitte vorher anfragen." },
      { q: "Wie gross darf ein Bauteil sein?", a: "Die verfügbaren Bauräume unserer Drucker findest du auf der Maschinen-Seite. Grössere Teile teilen wir auf Wunsch in verklebbare Segmente." },
      { q: "Wie schnell erhalte ich mein FDM-Teil?", a: "Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung, danach Versand innerhalb der Schweiz oder Abholung in Eschlikon TG." },
    ],
    related: [
      { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck", text: "Wenn feine Details wichtiger sind als Festigkeit." },
      { label: "FDM vs SLA im Vergleich", to: "/vergleich/fdm-vs-sla", text: "Welches Verfahren passt zu deinem Bauteil?" },
      { label: "Materialien im Überblick", to: "/materialien", text: "PLA, PETG, ABS, ASA, TPU und Resin." },
      { label: "Maschinenpark", to: "/maschinen", text: "Bauräume und eingesetzte Drucker." },
    ],
  },
  {
    slug: "sla-3d-druck",
    eyebrow: "Verfahren",
    h1: "SLA / Resin 3D-Druck – maximale Detailtreue",
    title: "SLA & Resin 3D-Druck Schweiz | Feine Details | 3DMuscio",
    description:
      "SLA/Resin 3D-Druck für glatte Oberflächen und feinste Details: Schweizer 3D-Druckservice mit Sofortpreis, persönlichem Service und Produktion in Eschlikon TG.",
    shortAnswer:
      "SLA (Resin-Druck) ist die richtige Wahl, wenn ein Teil sehr feine Details oder eine glatte Oberfläche braucht. Flüssiges Harz wird schichtweise mit Licht ausgehärtet, wodurch Schichten kaum sichtbar sind. Ideal für Modelle, Miniaturen und kleine Sichtteile – weniger geeignet für stark belastete Funktionsteile.",
    sections: [
      {
        title: "Wofür sich SLA eignet",
        bullets: [
          "Miniaturen und Figuren",
          "Design- und Präsentationsmodelle",
          "Kleine Bauteile mit feinen Geometrien",
          "Sichtteile mit glatter Oberfläche",
          "Passmuster und Formen mit engen Details",
        ],
      },
      {
        title: "Vorteile",
        bullets: [
          "Sehr feine Detailauflösung",
          "Nahezu unsichtbare Schichten",
          "Glatte, gut lackierbare Oberflächen",
          "Scharfe Kanten und dünne Wandstärken möglich",
        ],
      },
      {
        title: "Grenzen des Verfahrens",
        text: "Resin ist spröder als FDM-Kunststoffe und weniger temperaturbeständig. Für dauerhaft belastete oder schlagbeanspruchte Bauteile empfehlen wir FDM in PETG, ABS oder ASA. Auch UV-Licht setzt Resin-Teilen langfristig zu, weshalb sie sich für dauerhaften Ausseneinsatz nur eingeschränkt eignen.",
      },
      {
        title: "Nachbearbeitung",
        text: "Resin-Teile werden nach dem Druck gewaschen und nachgehärtet, Stützpunkte entfernt und die Flächen kontrolliert. Wir liefern die Teile gereinigt und ausgehärtet – Schleifen oder Lackieren ist auf Anfrage möglich.",
      },
    ],
    faqs: [
      { q: "Ist SLA teurer als FDM?", a: "Bei kleinen, detailreichen Teilen liegen die Kosten oft ähnlich; bei grösseren Volumen ist FDM meist günstiger. Der Kalkulator zeigt beide Varianten transparent." },
      { q: "Wie belastbar sind Resin-Teile?", a: "Resin ist hart, aber spröder als PETG oder ABS. Für mechanisch belastete Bauteile empfehlen wir FDM." },
      { q: "Welche Dateiformate brauche ich?", a: "STL, STEP, 3MF oder OBJ – dieselben Formate wie beim FDM-Druck." },
    ],
    related: [
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck", text: "Für belastbare Funktionsteile." },
      { label: "Resin vs FDM", to: "/vergleich/resin-vs-fdm", text: "Direkter Vergleich der Verfahren." },
      { label: "3D-Druck Kosten Schweiz", to: "/wissen/3d-druck-kosten-schweiz", text: "Woraus sich der Preis zusammensetzt." },
    ],
  },
  {
    slug: "3d-druck-prototypen",
    eyebrow: "Leistung",
    h1: "3D-Druck Prototypen – Ideen in Tagen statt Wochen testen",
    title: "3D-Druck Prototypen Schweiz | Rapid Prototyping | 3DMuscio",
    description:
      "Rapid Prototyping ab 1 Stück in FDM und SLA: Schweizer 3D-Druckservice für schnelle Prototypen – Sofortpreis, persönlicher Service, Produktion in der Schweiz.",
    shortAnswer:
      "Ein 3D-gedruckter Prototyp zeigt in Tagen, ob ein Design funktioniert – ohne Werkzeugkosten und ohne Mindestmenge. Bei 3DMuscio kannst du Funktions-, Design- und Passmuster einzeln bestellen und nach jeder Iteration direkt die nächste Version drucken lassen.",
    sections: [
      {
        title: "Typische Prototypen-Arten",
        bullets: [
          "Designmuster für Form, Anmutung und Grösse",
          "Funktionsprototypen zum mechanischen Test",
          "Passmuster für Einbau- und Toleranzprüfung",
          "Ergonomie-Muster für Griffe und Bedienteile",
          "Präsentationsmodelle für Kunden und Investoren",
        ],
      },
      {
        title: "Iterationen richtig planen",
        text: "Rapid Prototyping lohnt sich vor allem, wenn du mehrere Versionen kurz hintereinander testest. Bewährt hat sich: erste Version günstig in PLA für Form und Passung, zweite Version im späteren Zielmaterial (z. B. PETG oder ASA) für den Funktionstest, dritte Version als Präsentationsmuster mit feinerer Qualitätsstufe.",
      },
      {
        title: "Materialauswahl für Prototypen",
        bullets: [
          "PLA – günstig und maßhaltig für Formmuster",
          "PETG – belastbar für Funktionstests",
          "ABS / ASA – temperatur- und wetterfest",
          "TPU – flexible Teile, Dichtungen, Puffer",
          "Resin – feinste Details für Sicht- und Kleinteile",
        ],
      },
      {
        title: "Kostenfaktoren",
        text: "Den Preis bestimmen Materialverbrauch, Druckzeit, Qualitätsstufe und Nachbearbeitung. Weniger Volumen (Wandstärke, Hohlräume), eine drucklagengünstige Orientierung und eine passende Qualitätsstufe senken die Kosten deutlich. Der Online-Kalkulator zeigt diese Faktoren einzeln aus.",
      },
      {
        title: "Ablauf",
        text: "Datei hochladen, Material und Qualität wählen, Preis sehen und bestellen. Standard-Produktionszeit sind 48 Stunden ab Auftragsbestätigung. Bei unklaren Geometrien melden wir uns vor dem Druck mit einem Hinweis, statt ein Teil zu drucken, das nicht funktioniert.",
      },
    ],
    faqs: [
      { q: "Kann ich einen einzelnen Prototyp bestellen?", a: "Ja, wir fertigen ab 1 Stück ohne Mindestbestellmenge." },
      { q: "Wie genau sind Prototypen?", a: "Die typische Toleranz liegt bei ±0.2 mm. Bei engeren Anforderungen sprich uns vorher an, damit wir Orientierung und Qualitätsstufe abstimmen." },
      { q: "Ich habe nur eine Skizze, kein CAD – geht das?", a: "Schreib uns über das Kontaktformular mit Skizze, Maßen oder Foto. Wir sagen dir, was wir daraus umsetzen können." },
      { q: "Wie lange dauert ein Prototyp?", a: "Standard 48 Stunden Produktionszeit ab Auftragsbestätigung, danach Versand (1–2 Tage innerhalb der Schweiz) oder Abholung in Eschlikon TG." },
    ],
    related: [
      { label: "Prototypen-Service", to: "/leistungen/3d-druck-prototypen", text: "Überblick, Ablauf und Beispiele." },
      { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien", text: "Vom Prototyp zur Serie." },
      { label: "Materialien", to: "/materialien", text: "Welches Material für welchen Test?" },
    ],
  },
  {
    slug: "3d-druck-ersatzteile",
    eyebrow: "Leistung",
    h1: "3D-Druck Ersatzteile – nachfertigen statt neu kaufen",
    title: "Ersatzteile 3D-Druck Schweiz | Nachfertigung | 3DMuscio",
    description:
      "Ersatzteile nachfertigen nach STL, STEP, Zeichnung oder Muster: Schweizer 3D-Druckservice mit Sofortpreis, persönlichem Service und Produktion in der Schweiz.",
    shortAnswer:
      "Wenn ein Kunststoffteil bricht und nicht mehr lieferbar ist, lässt es sich meist per 3D-Druck nachfertigen. Wir drucken Ersatzteile nach STL-, STEP-, 3MF- oder OBJ-Datei – und in vielen Fällen auch nach Zeichnung, Maßangaben oder Muster. Gefertigt wird ab 1 Stück in Eschlikon TG.",
    sections: [
      {
        title: "Typische Ersatzteile",
        bullets: [
          "Halterungen, Clips und Klemmen",
          "Gehäuseteile und Abdeckungen",
          "Knöpfe, Griffe und Bedienteile",
          "Zahnräder und Mitnehmer",
          "Adapter und Anschlussstücke",
          "Nicht mehr lieferbare Kunststoffteile",
        ],
      },
      {
        title: "Was wir zum Nachbau brauchen",
        text: "Am schnellsten geht es mit einer 3D-Datei (STL, STEP, 3MF, OBJ). Ohne Datei helfen aussagekräftige Fotos mit Maßstab, die wichtigsten Maße und – wenn möglich – das Originalteil oder dessen Bruchstücke. Wir sagen dir vorab, ob und wie wir das Teil umsetzen können.",
      },
      {
        title: "Material nach Belastung wählen",
        bullets: [
          "PETG – guter Allrounder für Innenanwendungen",
          "ABS / ASA – hitze- und wetterbeständig, z. B. Motorraum oder Aussenbereich",
          "TPU – flexible Teile, Dichtungen, Puffer",
          "Nylon – abrasionsfest für Zahnräder und Lagerstellen",
          "PLA – nur für unbelastete Teile im Innenbereich",
        ],
      },
      {
        title: "Belastbarkeit realistisch einschätzen",
        text: "3D-gedruckte Teile sind kein 1:1-Ersatz für Spritzguss, kommen aber in vielen Fällen sehr nah heran. Wichtig sind Wandstärke, Füllgrad und die Druckrichtung relativ zur Belastung. Sag uns, wie das Teil beansprucht wird – wir richten es entsprechend aus.",
      },
    ],
    faqs: [
      { q: "Ich habe keine 3D-Datei. Was nun?", a: "Schick uns Fotos mit Maßstab und die Hauptmaße über das Kontaktformular. Wir prüfen, ob wir das Teil nachbauen können." },
      { q: "Dürfen markengeschützte Teile nachgedruckt werden?", a: "Wir fertigen keine Teile, die Schutzrechte Dritter verletzen. Für Reparaturteile im Eigenbedarf ist das in der Regel unproblematisch – im Zweifel bitte kurz anfragen." },
      { q: "Wie viele Teile kann ich bestellen?", a: "Ab 1 Stück, ohne Mindestbestellmenge. Bei mehreren Stück sinkt der Stückpreis, weil die Rüstkosten nur einmal anfallen." },
    ],
    related: [
      { label: "Ersatzteil-Service", to: "/leistungen/3d-druck-ersatzteile", text: "Ablauf und Beispiele." },
      { label: "Materialien", to: "/materialien", text: "Materialwahl nach Belastung." },
      { label: "3D-Druck Kosten", to: "/wissen/3d-druck-kosten-schweiz", text: "Was ein Ersatzteil kostet." },
    ],
  },
  {
    slug: "3d-druck-kleinserien",
    eyebrow: "Leistung",
    h1: "3D-Druck Kleinserien – Serienteile ohne Werkzeugkosten",
    title: "Kleinserien 3D-Druck Schweiz | Ohne Spritzgussform | 3DMuscio",
    description:
      "Kleinserien ab 1 Stück ohne Formkosten: Schweizer 3D-Druckservice für Serienteile – Sofortpreis, persönlicher Service, Produktion in der Schweiz, Mengenrabatt.",
    shortAnswer:
      "Kleinserien im 3D-Druck lohnen sich, solange die Stückzahl zu klein für eine Spritzgussform ist – typischerweise bis in den Bereich einiger hundert Teile. Es fallen keine Werkzeugkosten an, Änderungen sind jederzeit möglich, und wir produzieren ab 1 Stück in Eschlikon TG mit Mengenrabatt.",
    sections: [
      {
        title: "Wann 3D-Druck der Serienfertigung überlegen ist",
        bullets: [
          "Kleine Stückzahlen ohne Formkosten",
          "Produkte, die sich noch verändern",
          "Ersatz- und Nachserien für ältere Produkte",
          "Varianten und Individualisierungen pro Stück",
          "Schnelle Markttests vor der Serieninvestition",
        ],
      },
      {
        title: "Wann Spritzguss sinnvoller ist",
        text: "Ab Stückzahlen im mittleren vier- bis fünfstelligen Bereich amortisiert sich eine Spritzgussform meist, weil der Stückpreis dann deutlich unter dem Druckpreis liegt. Wenn du in diese Region kommst, sagen wir dir das offen – der 3D-Druck bleibt dann als Vorserie und für Ersatzteile sinnvoll.",
      },
      {
        title: "Kostenfaktoren bei Serien",
        text: "Rüstkosten fallen pro Auftrag nur einmal an, danach zählen Material und Druckzeit pro Teil. Grössere Mengen werden dadurch pro Stück günstiger – der Kalkulator zeigt den Mengenrabatt direkt bei der Stückzahl an. Kleinere Bauteile mit reduzierter Wandstärke und passender Orientierung senken die Kosten weiter.",
      },
      {
        title: "Gleichbleibende Qualität",
        text: "Wir drucken Serien mit identischen Parametern, gleicher Materialcharge (soweit verfügbar) und Sichtprüfung jedes Teils. Bei wiederkehrenden Aufträgen legen wir das Teil in der Bibliothek ab, damit Nachbestellungen exakt gleich produziert werden.",
      },
    ],
    faqs: [
      { q: "Ab welcher Menge gibt es Rabatt?", a: "Der Mengenrabatt wird im Online-Kalkulator automatisch berechnet und direkt bei der Stückzahl angezeigt." },
      { q: "Kann ich Teile nachbestellen?", a: "Ja. Wir hinterlegen deine Teile, damit Nachbestellungen mit denselben Parametern gefertigt werden." },
      { q: "Sind grössere Serien möglich?", a: "Für grössere Serien erstellen wir gern ein individuelles Angebot – melde dich über das Kontaktformular mit Datei, Stückzahl und Zieltermin." },
    ],
    related: [
      { label: "Kleinserien-Service", to: "/leistungen/3d-druck-kleinserien", text: "Überblick und Ablauf." },
      { label: "3D-Druck vs Spritzguss", to: "/vergleich/3d-druck-vs-spritzguss", text: "Ab wann sich eine Form lohnt." },
      { label: "Prototypen", to: "/leistungen/3d-druck-prototypen", text: "Der Schritt vor der Serie." },
    ],
  },
  {
    slug: "b2b-3d-druck",
    eyebrow: "Für Unternehmen",
    h1: "3D-Druck für Unternehmen – B2B-Service aus der Schweiz",
    title: "B2B 3D-Druck Schweiz – Rechnung, Kleinserien, Industriematerial | 3DMuscio",
    description:
      "3D-Druck für Schweizer Firmen: Prototypen, Ersatzteile und Kleinserien mit Sofortpreis, persönlichem Service, Rechnung mit QR-Zahlteil und Produktion in der Schweiz.",
    shortAnswer:
      "3DMuscio fertigt für Schweizer Unternehmen Prototypen, Betriebsmittel, Ersatzteile und Kleinserien im FDM- und SLA-Verfahren. Firmenkunden bestellen auf Rechnung (Schweizer QR-Rechnung), erhalten Mengenrabatt bereits ab kleinen Stückzahlen und wählen aus technischen Materialien wie PETG, ABS, ASA, TPU und Resin. Produziert wird in Eschlikon TG, Standardproduktionszeit 48 Stunden.",
    sections: [
      {
        title: "Was Firmenkunden bei uns bestellen",
        bullets: [
          "Prototypen für Produktentwicklung und Design-Reviews",
          "Betriebsmittel: Vorrichtungen, Lehren, Montage- und Prüfhilfen",
          "Ersatzteile für Maschinen und Anlagen, auch wenn das Original nicht mehr erhältlich ist",
          "Kleinserien ohne Werkzeug- und Formkosten",
          "Messe-, Muster- und Anschauungsteile",
        ],
      },
      {
        title: "Abwicklung und Bezahlung",
        text: "Firmenkunden können auf Rechnung bestellen – mit Schweizer QR-Rechnung inklusive Zahlteil, passend für die übliche Kreditorenverarbeitung. Alternativ stehen Karte, TWINT und Apple Pay zur Verfügung. Für wiederkehrende Aufträge legen wir Teile in unserer Bibliothek ab, damit Nachbestellungen mit identischen Parametern gefertigt werden.",
        bullets: [
          "Bestellung auf Rechnung mit QR-Zahlteil",
          "Angebot vor Auftragsfreigabe möglich",
          "Kundenportal mit Aufträgen, Dokumenten und Rechnungen",
          "Teilebibliothek für gleichbleibende Nachbestellungen",
        ],
      },
      {
        title: "Preise und Mengenrabatt",
        text: "Der Preis setzt sich aus Material, Maschinenzeit und einmaligen Rüstkosten pro Auftrag zusammen. Weil die Rüstkosten nur einmal anfallen, wird jedes weitere Teil pro Stück günstiger – der Online-Kalkulator zeigt den Mengenrabatt direkt bei der Stückzahl. Für grössere Serien oder Rahmenmengen erstellen wir ein individuelles Angebot.",
      },
      {
        title: "Materialien und Verfahren",
        text: "Für belastbare Funktionsteile setzen wir FDM mit PETG, ABS, ASA oder TPU ein; ASA und ABS für höhere Temperatur- und UV-Anforderungen, TPU für flexible Teile. Für feine Details und glatte Sichtflächen nutzen wir SLA/Resin. Typische FDM-Toleranz ±0.2 mm.",
      },
      {
        title: "Ablauf für Unternehmen",
        text: "Datei (STL, STEP, 3MF oder OBJ) im Online-Kalkulator hochladen, Material und Qualität wählen, Preis sofort sehen und bestellen oder ein Angebot anfordern. Wir produzieren in Eschlikon TG und versenden schweizweit – Abholung ist nach Absprache möglich.",
      },
    ],
    faqs: [
      { q: "Können wir als Firma auf Rechnung bestellen?", a: "Ja. Für Firmenkunden stellen wir eine Schweizer QR-Rechnung mit Zahlteil aus. Karte, TWINT und Apple Pay sind ebenfalls möglich." },
      { q: "Gibt es eine Mindestbestellmenge?", a: "Nein. Wir fertigen ab 1 Stück – Mengenrabatt wird im Kalkulator automatisch berücksichtigt." },
      { q: "Erhalten wir vorab ein Angebot?", a: "Ja. Sende Datei, Stückzahl und Zieltermin über das Kontaktformular, dann erstellen wir ein schriftliches Angebot." },
      { q: "Welche Materialien eignen sich für technische Bauteile?", a: "PETG für allgemeine Funktionsteile, ABS und ASA für höhere Temperatur- und UV-Belastung, TPU für flexible Teile, Resin für feine Details." },
      { q: "Wie lange dauert die Produktion?", a: "Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung, danach 1–2 Tage Versand innerhalb der Schweiz." },
    ],
    related: [
      { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien", text: "Serienfertigung ohne Werkzeugkosten." },
      { label: "Prototypen", to: "/leistungen/3d-druck-prototypen", text: "Schnelle Iterationen in der Entwicklung." },
      { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile", text: "Teile nachdrucken, die es nicht mehr gibt." },
      { label: "3D-Druck vs Spritzguss", to: "/vergleich/3d-druck-vs-spritzguss", text: "Ab welcher Menge sich eine Form lohnt." },
      { label: "Preisrechner", to: "/kalkulator-online", text: "Datei hochladen, Preis sofort sehen." },
    ],
  },
];


export const getService = (slug?: string) => services.find((s) => s.slug === slug);
