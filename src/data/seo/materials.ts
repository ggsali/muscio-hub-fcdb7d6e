import type { AnswerFaq, AnswerSection, AnswerTable, RelatedLink } from "@/components/site/AnswerLanding";

export interface MaterialContent {
  slug: string;
  name: string;
  process: "FDM" | "SLA";
  h1: string;
  title: string;
  description: string;
  shortAnswer: string;
  sections: AnswerSection[];
  table: AnswerTable;
  faqs: AnswerFaq[];
  related: RelatedLink[];
}

const specTable = (rows: string[][]): AnswerTable => ({
  title: "Technische Eigenschaften",
  headers: ["Eigenschaft", "Wert"],
  rows,
});

export const materials: MaterialContent[] = [
  {
    slug: "pla",
    name: "PLA",
    process: "FDM",
    h1: "PLA 3D-Druck – günstig, präzise, für den Innenbereich",
    title: "PLA 3D-Druck: Eigenschaften & Anwendungen | 3DMuscio",
    description:
      "PLA im 3D-Druck: Eigenschaften, Temperaturgrenzen, Vor- und Nachteile sowie typische Anwendungen. Online kalkulieren bei 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "PLA nimmst du, wenn ein Teil günstig, maßhaltig und optisch saubersein soll und im Innenbereich bleibt – etwa Modelle, Designmuster und Deko. Sobald Wärme, Sonne oder mechanische Dauerbelastung ins Spiel kommen, ist PETG oder ABS/ASA die bessere Wahl.",
    sections: [
      { title: "Eigenschaften", text: "PLA druckt sehr maßhaltig, verzieht sich kaum und liefert scharfe Kanten. Es ist steif, aber spröde: unter Schlagbelastung bricht es eher, als sich zu verformen. Die Wärmeformbeständigkeit endet bei rund 55 °C – ein Auto im Sommer ist damit tabu." },
      { title: "Vorteile", bullets: ["günstigstes Standardmaterial", "sehr gute Maßhaltigkeit", "feine Detailwiedergabe", "grosse Farbauswahl"] },
      { title: "Nachteile", bullets: ["nicht temperaturbeständig (bis ca. 55 °C)", "spröde bei Schlagbelastung", "kaum UV-/witterungsbeständig", "geringe Chemikalienbeständigkeit"] },
      { title: "Typische Anwendungen", bullets: ["Designmuster und Formprüfung", "Anschauungsmodelle", "Dekoration und Geschenke", "unbelastete Halterungen im Innenbereich"] },
      { title: "Ungeeignet für", bullets: ["Teile im Auto oder in der Sonne", "Aussenbereich", "dauerhaft belastete Funktionsteile", "Teile mit Chemikalienkontakt"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 55 °C"],
      ["Festigkeit", "gut, aber spröde"],
      ["Outdoor-Eignung", "gering"],
      ["Chemikalienbeständigkeit", "gering"],
      ["Typische Toleranz", "±0.2 mm"],
    ]),
    faqs: [
      { q: "Ist PLA das günstigste Material?", a: "In der Regel ja – den exakten Preis für dein Teil zeigt der Online-Kalkulator." },
      { q: "Kann ich PLA draussen verwenden?", a: "Nur kurzfristig. Für den Aussenbereich empfehlen wir PETG oder ASA." },
    ],
    related: [
      { label: "PLA vs PETG", to: "/vergleich/pla-vs-petg" },
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
      { label: "Alle Materialien", to: "/materialien" },
    ],
  },
  {
    slug: "petg",
    name: "PETG",
    process: "FDM",
    h1: "PETG 3D-Druck – der Allrounder für Funktionsteile",
    title: "PETG 3D-Druck: Eigenschaften & Anwendungen | 3DMuscio",
    description:
      "PETG im 3D-Druck: zäh, feuchtigkeitsresistent und bis ca. 75 °C belastbar. Eigenschaften, Anwendungen und Alternativen – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "PETG ist die richtige Wahl für die meisten Funktionsteile: es ist zäher als PLA, hält bis rund 75 °C, verträgt Feuchtigkeit und ist chemisch robust. Wenn du unsicher bist, welches Material passt, ist PETG in der Praxis der sicherste Standard.",
    sections: [
      { title: "Eigenschaften", text: "PETG verbindet gute Zähigkeit mit einfacher Verarbeitung. Es bricht nicht so leicht wie PLA, verzieht sich weniger als ABS und nimmt Feuchtigkeit deutlich besser weg. Die Oberfläche wirkt leicht glänzend." },
      { title: "Vorteile", bullets: ["zäh und schlagtoleranter als PLA", "bis ca. 75 °C einsetzbar", "gute Chemikalien- und Feuchtigkeitsbeständigkeit", "geringe Verzugsneigung"] },
      { title: "Nachteile", bullets: ["Oberfläche lässt sich schlechter lackieren", "Fäden/Stringing möglich – wir gleichen das über die Druckparameter aus", "nicht so temperaturfest wie ABS/ASA"] },
      { title: "Typische Anwendungen", bullets: ["Gehäuse und Abdeckungen", "Halterungen und Klemmen", "Behälter und Wannen", "Funktionsprototypen", "Ersatzteile im Innenbereich"] },
      { title: "Ungeeignet für", bullets: ["Dauerbetrieb über ca. 75 °C", "Sichtteile, die lackiert werden sollen"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 75 °C"],
      ["Festigkeit", "gut und zäh"],
      ["Outdoor-Eignung", "mittel"],
      ["Chemikalienbeständigkeit", "gut"],
      ["Typische Toleranz", "±0.2 mm"],
    ]),
    faqs: [
      { q: "Ist PETG wasserdicht?", a: "Mit ausreichender Wandstärke lassen sich weitgehend dichte Teile drucken. Absolute Dichtheit garantieren wir nicht." },
      { q: "PETG oder ABS?", a: "PETG für Standardanwendungen, ABS wenn es wärmer als 75 °C wird oder das Teil nachbearbeitet wird. Details im Vergleich." },
    ],
    related: [
      { label: "PETG vs ABS", to: "/vergleich/petg-vs-abs" },
      { label: "PLA vs PETG", to: "/vergleich/pla-vs-petg" },
      { label: "Ersatzteile drucken", to: "/leistungen/3d-druck-ersatzteile" },
    ],
  },
  {
    slug: "abs",
    name: "ABS",
    process: "FDM",
    h1: "ABS 3D-Druck – temperaturfest und nachbearbeitbar",
    title: "ABS 3D-Druck: Eigenschaften & Anwendungen | 3DMuscio",
    description:
      "ABS im 3D-Druck: bis ca. 95 °C temperaturbeständig, schlagfest, gut schleif- und klebbar. Anwendungen und Alternativen – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "ABS wählst du, wenn ein Teil warm wird oder mechanisch nachbearbeitet werden soll: es hält bis rund 95 °C, ist schlagfest und lässt sich gut schleifen, kleben und lackieren. Für dauerhaften Ausseneinsatz ist ASA die UV-stabilere Alternative.",
    sections: [
      { title: "Eigenschaften", text: "ABS ist der Klassiker unter den technischen Kunststoffen: zäh, temperaturbeständig und gut nachbearbeitbar. Im Druck ist es anspruchsvoller (Verzugsneigung), was wir über Druckraumtemperatur und Parameter kontrollieren." },
      { title: "Vorteile", bullets: ["bis ca. 95 °C einsetzbar", "schlagfest und zäh", "gut schleif-, kleb- und lackierbar", "bewährt für Industrieteile"] },
      { title: "Nachteile", bullets: ["geringe UV-Beständigkeit", "höhere Verzugsneigung im Druck", "Geruchsentwicklung während der Produktion"] },
      { title: "Typische Anwendungen", bullets: ["Bauteile im Fahrzeuginnenraum", "Industriegehäuse", "Vorrichtungen mit Wärmeeinfluss", "Teile, die lackiert werden"] },
      { title: "Ungeeignet für", bullets: ["dauerhaften Ausseneinsatz mit direkter Sonne (dann ASA)"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 95 °C"],
      ["Festigkeit", "hoch, schlagfest"],
      ["Outdoor-Eignung", "mittel (UV-empfindlich)"],
      ["Chemikalienbeständigkeit", "mittel"],
      ["Typische Toleranz", "±0.2 mm"],
    ]),
    faqs: [
      { q: "ABS oder ASA?", a: "Innen ABS, draussen ASA – ASA ist deutlich UV-stabiler bei sonst ähnlichen Eigenschaften." },
      { q: "Kann ABS lackiert werden?", a: "Ja, ABS lässt sich gut schleifen, kleben und lackieren." },
    ],
    related: [
      { label: "ABS vs ASA", to: "/vergleich/abs-vs-asa" },
      { label: "PETG vs ABS", to: "/vergleich/petg-vs-abs" },
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
    ],
  },
  {
    slug: "asa",
    name: "ASA",
    process: "FDM",
    h1: "ASA 3D-Druck – wetterfest für den Aussenbereich",
    title: "ASA 3D-Druck: Eigenschaften & Anwendungen | 3DMuscio",
    description:
      "ASA im 3D-Druck: UV- und witterungsbeständig, bis ca. 100 °C belastbar. Ideal für Aussenteile und Fahrzeuge – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "ASA ist das Material für Teile, die draussen bleiben: es ist UV- und witterungsbeständig und hält bis rund 100 °C. Mechanisch verhält es sich ähnlich wie ABS, vergilbt und verspödet in der Sonne aber deutlich langsamer.",
    sections: [
      { title: "Eigenschaften", text: "ASA ist ein technischer Kunststoff mit dem Eigenschaftsprofil von ABS plus deutlich besserer UV-Stabilität. Damit ist es das Standardmaterial für dauerhaft bewitterte Bauteile." },
      { title: "Vorteile", bullets: ["sehr gute UV-Beständigkeit", "witterungsfest", "bis ca. 100 °C einsetzbar", "gut nachbearbeitbar"] },
      { title: "Nachteile", bullets: ["höhere Verzugsneigung im Druck", "Materialpreis über PLA/PETG"] },
      { title: "Typische Anwendungen", bullets: ["Halterungen im Aussenbereich", "Fahrzeugteile", "Gartentechnik", "Gehäuse mit Sonneneinstrahlung"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 100 °C"],
      ["Festigkeit", "hoch"],
      ["Outdoor-Eignung", "sehr gut"],
      ["UV-Beständigkeit", "sehr gut"],
      ["Typische Toleranz", "±0.2 mm"],
    ]),
    faqs: [
      { q: "Wie lange hält ASA draussen?", a: "ASA ist für dauerhaften Ausseneinsatz konzipiert. Eine konkrete Lebensdauer hängt von Bauteil und Belastung ab – deshalb nennen wir hier keine Garantiezeit." },
    ],
    related: [
      { label: "ABS vs ASA", to: "/vergleich/abs-vs-asa" },
      { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile" },
      { label: "Alle Materialien", to: "/materialien" },
    ],
  },
  {
    slug: "tpu",
    name: "TPU",
    process: "FDM",
    h1: "TPU 3D-Druck – flexible und gummiartige Teile",
    title: "TPU 3D-Druck: flexible Teile & Dichtungen | 3DMuscio",
    description:
      "TPU im 3D-Druck: flexibel, abriebfest und dämpfend. Für Dichtungen, Puffer und Griffe. Eigenschaften und Anwendungen – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "TPU nimmst du, wenn ein Teil biegsam, dämpfend oder gummiartig sein soll – etwa Dichtungen, Puffer, Griffe oder Schutzhüllen. Es ist abriebfest und zäh, aber nicht formstabil wie ein harter Kunststoff.",
    sections: [
      { title: "Eigenschaften", text: "TPU ist ein thermoplastisches Elastomer: es lässt sich biegen und komprimieren und kehrt in seine Ausgangsform zurück. Je nach Wandstärke und Füllgrad steuern wir, wie weich oder steif ein Bauteil wirkt." },
      { title: "Vorteile", bullets: ["flexibel und dämpfend", "hohe Abriebfestigkeit", "zäh, praktisch bruchsicher", "gute Chemikalienverträglichkeit"] },
      { title: "Nachteile", bullets: ["längere Druckzeit", "nicht formstabil bei Druckbelastung", "feine Details begrenzt"] },
      { title: "Typische Anwendungen", bullets: ["Dichtungen und Manschetten", "Puffer und Dämpfer", "Griffe und Bedienelemente", "Schutzhüllen", "Riemen und Auflagen"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 70 °C"],
      ["Eigenschaft", "flexibel, elastisch"],
      ["Abriebfestigkeit", "hoch"],
      ["Outdoor-Eignung", "mittel"],
    ]),
    faqs: [
      { q: "Wie weich wird das Teil?", a: "Die gefühlte Härte hängt von Geometrie, Wandstärke und Füllgrad ab. Beschreibe uns die gewünschte Funktion, dann stimmen wir das ab." },
      { q: "Dauert TPU länger?", a: "Ja, flexible Materialien werden langsamer gedruckt – das ist im Kalkulator in der Druckzeit berücksichtigt." },
    ],
    related: [
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
      { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile" },
      { label: "Alle Materialien", to: "/materialien" },
    ],
  },
  {
    slug: "nylon",
    name: "Nylon",
    process: "FDM",
    h1: "Nylon 3D-Druck – abriebfest für mechanische Teile",
    title: "Nylon (PA) 3D-Druck: Zahnräder & Lager | 3DMuscio",
    description:
      "Nylon im 3D-Druck: hohe Festigkeit, Abriebfestigkeit und Zähigkeit für Zahnräder, Lager und Werkzeuge. Eigenschaften – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "Nylon (Polyamid) ist das Material für mechanisch stark beanspruchte Bauteile: Zahnräder, Gleitlager, Mitnehmer oder Werkzeuge. Es ist zäh, abriebfest und temperaturbeständig bis rund 110 °C, nimmt aber Feuchtigkeit auf und muss trocken gelagert werden.",
    sections: [
      { title: "Eigenschaften", text: "Nylon kombiniert hohe Zähigkeit mit sehr guter Verschleissfestigkeit und guten Gleiteigenschaften. Es verzieht sich im Druck stärker als PLA oder PETG, weshalb wir Geometrie und Orientierung sorgfältig abstimmen." },
      { title: "Vorteile", bullets: ["hohe Festigkeit und Zähigkeit", "sehr abriebfest", "gute Gleiteigenschaften", "bis ca. 110 °C einsetzbar"] },
      { title: "Nachteile", bullets: ["nimmt Feuchtigkeit auf", "höhere Verzugsneigung", "UV-empfindlich"] },
      { title: "Typische Anwendungen", bullets: ["Zahnräder und Mitnehmer", "Gleitlager und Buchsen", "Werkzeug- und Maschinenteile", "belastete Halterungen"] },
    ],
    table: specTable([
      ["Verfahren", "FDM"],
      ["Temperaturbeständigkeit", "bis ca. 110 °C"],
      ["Festigkeit", "sehr hoch"],
      ["Abriebfestigkeit", "sehr hoch"],
      ["Outdoor-Eignung", "mittel (UV-empfindlich)"],
    ]),
    faqs: [
      { q: "Eignet sich Nylon für Zahnräder?", a: "Ja, dank Abriebfestigkeit und guten Gleiteigenschaften ist Nylon dafür das bevorzugte Material." },
      { q: "Ist Nylon immer verfügbar?", a: "Die aktuell verfügbaren Materialien und Farben siehst du direkt im Online-Kalkulator." },
    ],
    related: [
      { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile" },
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
      { label: "Alle Materialien", to: "/materialien" },
    ],
  },
  {
    slug: "resin",
    name: "Resin",
    process: "SLA",
    h1: "Resin 3D-Druck – feinste Details und glatte Oberflächen",
    title: "Resin 3D-Druck (SLA): Miniaturen & Modelle | 3DMuscio",
    description:
      "Resin im SLA-3D-Druck: höchste Detailauflösung und glatte Oberflächen für Miniaturen, Modelle und Kleinteile – 3DMuscio, Eschlikon TG.",
    shortAnswer:
      "Resin nimmst du, wenn Optik und Detailtreue entscheidend sind: Miniaturen, Designmodelle, Schmuckmuster und kleine Sichtteile. Die Oberfläche ist glatt und gut lackierbar, das Material aber spröder und weniger temperaturbeständig als FDM-Kunststoffe.",
    sections: [
      { title: "Eigenschaften", text: "Beim SLA-Druck härtet Licht flüssiges Harz schichtweise aus. Dadurch sind Schichten praktisch unsichtbar und Details unter einem Millimeter darstellbar. Nach dem Druck werden die Teile gewaschen und nachgehärtet." },
      { title: "Vorteile", bullets: ["höchste Detailauflösung", "glatte, lackierbare Oberflächen", "scharfe Kanten und feine Stege", "sehr gute Maßtreue bei Kleinteilen"] },
      { title: "Nachteile", bullets: ["spröder als FDM-Materialien", "geringe Temperaturbeständigkeit", "nicht UV-stabil für Dauereinsatz draussen", "eher kleine Bauteile"] },
      { title: "Typische Anwendungen", bullets: ["Miniaturen und Figuren", "Design- und Präsentationsmodelle", "Schmuckmuster", "filigrane Kleinteile"] },
    ],
    table: specTable([
      ["Verfahren", "SLA / Resin"],
      ["Temperaturbeständigkeit", "gering"],
      ["Detailauflösung", "sehr hoch"],
      ["Oberfläche", "glatt"],
      ["Outdoor-Eignung", "gering"],
    ]),
    faqs: [
      { q: "Sind Resin-Teile belastbar?", a: "Für leichte Belastung ja, bei Schlag- oder Dauerbelastung empfehlen wir FDM in PETG, ABS oder ASA." },
      { q: "Kommen Resin-Teile fertig gereinigt?", a: "Ja, wir waschen und härten die Teile nach und entfernen die Stützpunkte." },
    ],
    related: [
      { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck" },
      { label: "Resin vs FDM", to: "/vergleich/resin-vs-fdm" },
      { label: "Alle Materialien", to: "/materialien" },
    ],
  },
];

export const getMaterial = (slug?: string) =>
  materials.find((m) => m.slug === slug?.toLowerCase());
