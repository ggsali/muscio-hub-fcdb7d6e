import type { AnswerFaq, AnswerSection, AnswerTable, RelatedLink } from "@/components/site/AnswerLanding";

export interface ComparisonContent {
  slug: string;
  h1: string;
  title: string;
  description: string;
  shortAnswer: string;
  table: AnswerTable;
  sections: AnswerSection[];
  faqs: AnswerFaq[];
  related: RelatedLink[];
}

export const comparisons: ComparisonContent[] = [
  {
    slug: "pla-vs-petg",
    h1: "PLA vs PETG – welches Material passt zu deinem Teil?",
    title: "PLA vs PETG: Vergleich für 3D-Druck | 3DMuscio",
    description:
      "PLA oder PETG? Vergleich von Festigkeit, Temperaturbeständigkeit, Outdoor-Eignung und typischen Anwendungen – mit klarer Empfehlung von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: PLA eignet sich für einfache Prototypen, Modelle und dekorative Teile im Innenbereich. PETG ist meist die bessere Wahl für belastbare Funktionsteile sowie Anwendungen mit höherer Feuchtigkeits- oder Temperaturbelastung. Bei Unsicherheit ist PETG der sicherere Allrounder.",
    table: {
      headers: ["Kriterium", "PLA", "PETG"],
      rows: [
        ["Festigkeit", "gut, aber spröde", "gut und zäher"],
        ["Temperaturbeständigkeit", "bis ca. 55 °C", "bis ca. 75 °C"],
        ["Outdoor-Eignung", "gering", "mittel"],
        ["Chemikalienbeständigkeit", "gering", "gut"],
        ["Maßhaltigkeit", "sehr gut", "gut"],
        ["Typische Anwendung", "Modelle, Formmuster, Deko", "Funktionsteile, Gehäuse, Behälter"],
      ],
    },
    sections: [
      {
        title: "Wann PLA die richtige Wahl ist",
        bullets: [
          "Designmuster und Formprüfung",
          "Modelle, Deko und Anschauungsobjekte",
          "Teile mit feinen Kanten und hoher Maßhaltigkeit",
          "Günstige erste Iteration eines Prototyps",
        ],
      },
      {
        title: "Wann PETG besser passt",
        bullets: [
          "Funktionsteile mit mechanischer Belastung",
          "Teile, die Feuchtigkeit ausgesetzt sind",
          "Gehäuse und Behälter",
          "Anwendungen über ca. 55 °C",
        ],
      },
      {
        title: "Praxis-Empfehlung",
        text: "Für die erste Iteration eines Prototyps ist PLA günstig und schnell. Sobald das Teil eine echte Funktion übernimmt – tragen, klemmen, halten, draussen liegen – wechseln wir in PETG. Wird es noch heisser oder UV-intensiver, sind ABS oder ASA die nächste Stufe.",
      },
      {
        title: "Was kostet der Unterschied?",
        text: "Der Aufpreis von PLA auf PETG hängt vom Bauteilvolumen ab und liegt bei den meisten Teilen im einstelligen Frankenbereich. Lade deine Datei im Online-Kalkulator hoch und wechsle das Material – du siehst den Preisunterschied sofort, bevor du bestellst.",
      },
    ],
    faqs: [
      { q: "Ist PETG teurer als PLA?", a: "Der Materialpreis liegt meist leicht höher; im Online-Kalkulator siehst du für dein Teil den exakten Unterschied." },
      { q: "Ist PLA lebensmittelecht?", a: "Wir machen keine Lebensmittel- oder Medizinzulassungs-Aussagen für gedruckte Teile. Für solche Anwendungen bitte vorher anfragen." },
      { q: "Welches Material hält im Auto?", a: "Weder PLA noch PETG sind für heisse Innenräume ideal – dafür empfehlen wir ABS oder ASA." },
      { q: "Welches Material ist einfacher zu verarbeiten?", a: "Für dich als Kundschaft spielt das kaum eine Rolle – wir übernehmen die Druckvorbereitung. Beide Materialien drucken wir auf unseren CoreXY-Maschinen zuverlässig." },
      { q: "Kann ich PLA nachträglich draussen verwenden?", a: "Nicht empfohlen: PLA verliert durch UV und Feuchtigkeit über Monate an Festigkeit. Für Aussenteile nimm PETG, besser noch ASA." },
    ],
    related: [
      { label: "PETG vs ABS", to: "/vergleich/petg-vs-abs", text: "Die nächste Stufe bei Temperatur." },
      { label: "Alle Materialien", to: "/materialien", text: "Eigenschaften und Preise." },
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck", text: "Verfahren für beide Materialien." },
    ],
  },
  {
    slug: "petg-vs-abs",
    h1: "PETG vs ABS – Allrounder oder Temperaturprofi?",
    title: "PETG vs ABS: Vergleich für 3D-Druck | 3DMuscio",
    description:
      "PETG oder ABS? Vergleich von Temperaturbeständigkeit, Zähigkeit, Nachbearbeitung und Anwendungen – mit klarer Empfehlung von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: PETG ist der pflegeleichte Allrounder für die meisten Funktionsteile. ABS wählst du, wenn ein Teil höhere Temperaturen aushalten oder mechanisch nachbearbeitet (schleifen, kleben, glätten) werden soll. Für dauerhaften Ausseneinsatz ist ASA statt ABS die bessere Variante.",
    table: {
      headers: ["Kriterium", "PETG", "ABS"],
      rows: [
        ["Temperaturbeständigkeit", "bis ca. 75 °C", "bis ca. 95 °C"],
        ["Zähigkeit", "gut", "gut, schlagfest"],
        ["UV-Beständigkeit", "mittel", "gering"],
        ["Nachbearbeitung", "eingeschränkt", "gut schleif- und klebbar"],
        ["Verzugsneigung im Druck", "gering", "höher"],
        ["Typische Anwendung", "Gehäuse, Funktionsteile", "Automotive-Innenraum, Industrieteile"],
      ],
    },
    sections: [
      {
        title: "Für PETG entscheiden",
        bullets: [
          "Standard-Funktionsteile und Gehäuse",
          "Teile mit Feuchtigkeitskontakt",
          "Gute Maßhaltigkeit ohne Verzug",
        ],
      },
      {
        title: "Für ABS entscheiden",
        bullets: [
          "Einsatz über ca. 75 °C",
          "Teile, die geschliffen, geklebt oder lackiert werden",
          "Schlagbeanspruchte Bauteile",
        ],
      },
      {
        title: "Und was ist mit ASA?",
        text: "ASA hat ein sehr ähnliches Eigenschaftsprofil wie ABS, ist aber deutlich UV-stabiler. Sobald ein Teil dauerhaft draussen liegt, empfehlen wir ASA.",
      },
    ],
    faqs: [
      { q: "Riecht ABS beim Druck?", a: "ABS entwickelt beim Druck stärkere Gerüche – das betrifft die Produktion bei uns, nicht das fertige Teil." },
      { q: "Kann ich PETG lackieren?", a: "Nur eingeschränkt, Lack haftet auf PETG schlechter. Für lackierte Sichtteile sind ABS/ASA oder Resin besser." },
    ],
    related: [
      { label: "ABS vs ASA", to: "/vergleich/abs-vs-asa", text: "Der Unterschied bei UV-Belastung." },
      { label: "PLA vs PETG", to: "/vergleich/pla-vs-petg", text: "Die Stufe darunter." },
      { label: "Materialien", to: "/materialien", text: "Alle verfügbaren Materialien." },
    ],
  },
  {
    slug: "abs-vs-asa",
    h1: "ABS vs ASA – der Unterschied liegt draussen",
    title: "ABS vs ASA: Vergleich für 3D-Druck | 3DMuscio",
    description:
      "ABS oder ASA? Beide sind temperaturbeständig – ASA hält UV-Strahlung deutlich besser aus. Vergleich und Empfehlung von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: ABS und ASA sind mechanisch und thermisch sehr ähnlich. Der entscheidende Unterschied ist die UV-Beständigkeit: ASA vergilbt und verspödet im Freien deutlich langsamer. Für Innenanwendungen genügt ABS, für dauerhaften Ausseneinsatz nimm ASA.",
    table: {
      headers: ["Kriterium", "ABS", "ASA"],
      rows: [
        ["Temperaturbeständigkeit", "bis ca. 95 °C", "bis ca. 100 °C"],
        ["UV-Beständigkeit", "gering", "sehr gut"],
        ["Witterungsbeständigkeit", "mittel", "sehr gut"],
        ["Nachbearbeitung", "gut", "gut"],
        ["Typische Anwendung", "Innenraum, Industrie", "Aussenbereich, Automotive-Aussenteile"],
      ],
    },
    sections: [
      {
        title: "Wann ASA klar besser ist",
        bullets: [
          "Teile für den Aussenbereich",
          "Halterungen an Fahrzeugen",
          "Bauteile mit direkter Sonneneinstrahlung",
          "Anwendungen mit Wetterwechsel",
        ],
      },
      {
        title: "Wann ABS ausreicht",
        text: "Im Innenbereich, in Gehäusen und in Industrieteilen ohne UV-Belastung liefert ABS praktisch dieselben Eigenschaften – oft zu einem etwas günstigeren Preis.",
      },
    ],
    faqs: [
      { q: "Kann ich ABS aussen mit Lack schützen?", a: "Eine Lackierung verlängert die Lebensdauer, ersetzt aber ASA nicht. Für dauerhaften Ausseneinsatz bleibt ASA die bessere Wahl." },
    ],
    related: [
      { label: "PETG vs ABS", to: "/vergleich/petg-vs-abs" },
      { label: "Materialien", to: "/materialien" },
      { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile" },
    ],
  },
  {
    slug: "fdm-vs-sla",
    h1: "FDM vs SLA – welches 3D-Druckverfahren brauchst du?",
    title: "FDM vs SLA: Verfahren im Vergleich | 3DMuscio",
    description:
      "FDM oder SLA? Vergleich von Festigkeit, Detailgenauigkeit, Oberfläche, Bauteilgrösse und Kosten – mit klarer Empfehlung von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: FDM ist die richtige Wahl für belastbare Funktionsteile, grössere Bauteile und günstige Prototypen. SLA/Resin gewinnt bei feinsten Details und glatten Oberflächen, ist aber spröder und weniger temperaturbeständig. Belastung entscheidet für FDM, Optik für SLA.",
    table: {
      headers: ["Kriterium", "FDM", "SLA / Resin"],
      rows: [
        ["Festigkeit", "hoch, zäh", "hart, aber spröde"],
        ["Detailauflösung", "gut", "sehr hoch"],
        ["Oberfläche", "Schichten sichtbar", "glatt"],
        ["Bauteilgrösse", "auch grössere Teile", "eher klein"],
        ["Temperaturbeständigkeit", "bis ca. 100 °C (ASA)", "gering"],
        ["Kosten bei Volumen", "günstiger", "höher"],
        ["Typische Anwendung", "Funktionsteile, Ersatzteile", "Miniaturen, Sichtteile"],
      ],
    },
    sections: [
      {
        title: "Entscheidungshilfe",
        bullets: [
          "Teil wird belastet → FDM",
          "Teil wird gesehen → SLA",
          "Teil ist grösser als eine Handfläche → FDM",
          "Teil hat Details unter 1 mm → SLA",
          "Teil wird warm oder liegt draussen → FDM (ABS/ASA)",
        ],
      },
      {
        title: "Kombination ist möglich",
        text: "Bei mehrteiligen Projekten drucken wir belastete Komponenten in FDM und Sichtteile in Resin. Lade einfach alle Dateien in einer Anfrage hoch – wir schlagen pro Teil das passende Verfahren vor.",
      },
      {
        title: "Was bedeutet das für die Oberfläche?",
        text: "FDM-Teile zeigen je nach Schichthöhe feine Linien – bei der Qualitätsstufe „Fein“ kaum sichtbar, bei „Draft“ deutlich. Resin-Teile kommen praktisch schichtfrei aus der Produktion und eignen sich direkt als Lackiergrundlage. Wenn ein FDM-Teil glatt aussehen soll, ist Nachbearbeitung (schleifen, füllern, lackieren) nötig – dabei helfen ABS/ASA, weil sie sich gut bearbeiten lassen.",
      },
    ],
    faqs: [
      { q: "Was ist günstiger?", a: "Bei grösseren Volumen ist FDM klar günstiger. Bei kleinen, detailreichen Teilen liegen beide nahe beieinander." },
      { q: "Welches Verfahren wähle ich im Kalkulator?", a: "Du wählst das Material – daraus ergibt sich das Verfahren. Resin steht für SLA, alle Filamente für FDM." },
      { q: "Wie gross darf ein Teil sein?", a: "FDM erlaubt deutlich grössere Bauteile; übergrosse Teile teilen wir bei Bedarf und fügen sie nach dem Druck zusammen. Resin ist auf kleinere Bauteile optimiert." },
      { q: "Welches Verfahren ist schneller?", a: "Kleine Resin-Teile sind oft in wenigen Stunden fertig, grössere FDM-Teile brauchen entsprechend länger. In beiden Verfahren gilt unser Standard von 48 Stunden Produktionszeit." },
    ],
    related: [
      { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
      { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck" },
      { label: "Kosten im 3D-Druck", to: "/wissen/3d-druck-kosten-schweiz" },
    ],
  },
  {
    slug: "resin-vs-fdm",
    h1: "Resin vs FDM – Detailtreue gegen Belastbarkeit",
    title: "Resin vs FDM: Vergleich für 3D-Druck | 3DMuscio",
    description:
      "Resin oder FDM-Filament? Was die Verfahren bei Oberfläche, Festigkeit, Nachbearbeitung und Preis unterscheidet – Empfehlung von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: Resin liefert die schönere Oberfläche und feinere Details, FDM das belastbarere und günstigere Bauteil. Für Figuren, Modelle und filigrane Kleinteile ist Resin die richtige Wahl; für alles, was etwas halten oder aushalten muss, FDM.",
    table: {
      headers: ["Kriterium", "Resin (SLA)", "FDM"],
      rows: [
        ["Oberfläche", "glatt, kaum Schichten", "Schichten sichtbar"],
        ["Details", "sehr fein", "gut"],
        ["Schlagfestigkeit", "gering", "gut"],
        ["Nachbearbeitung", "waschen + nachhärten nötig", "Stützen entfernen"],
        ["Materialauswahl", "begrenzt", "breit (PLA–ASA, TPU, Nylon)"],
      ],
    },
    sections: [
      {
        title: "Wann Resin",
        bullets: ["Miniaturen und Figuren", "Schmuck- und Designmodelle", "kleine Bauteile mit feinen Strukturen", "Sichtflächen zum Lackieren"],
      },
      {
        title: "Wann FDM",
        bullets: ["Funktionsteile", "Ersatzteile", "grössere Bauteile", "Teile für Wärme oder Aussenbereich"],
      },
    ],
    faqs: [
      { q: "Kann Resin auch Funktionsteile?", a: "Für leicht belastete Kleinteile ja. Bei Schlag- oder Dauerbelastung empfehlen wir FDM." },
      { q: "Sind Resin-Teile UV-stabil?", a: "Nur eingeschränkt – dauerhafte Sonneneinstrahlung setzt Resin zu." },
    ],
    related: [
      { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck" },
      { label: "FDM vs SLA", to: "/vergleich/fdm-vs-sla" },
      { label: "Materialien", to: "/materialien" },
    ],
  },
  {
    slug: "3d-druck-vs-cnc",
    h1: "3D-Druck vs CNC-Fräsen – welches Fertigungsverfahren?",
    title: "3D-Druck vs CNC-Fräsen: Vergleich | 3DMuscio",
    description:
      "3D-Druck oder CNC? Vergleich von Geometriefreiheit, Toleranzen, Materialien, Stückkosten und Lieferzeit – Orientierungshilfe von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: 3D-Druck ist überlegen, wenn Geometrien komplex sind, Stückzahlen klein bleiben und es schnell gehen soll. CNC-Fräsen gewinnt bei sehr engen Toleranzen, Metallteilen und maximaler Materialfestigkeit. Für Prototypen und Kleinserien aus Kunststoff ist der 3D-Druck meist der schnellere und günstigere Weg.",
    table: {
      headers: ["Kriterium", "3D-Druck (FDM/SLA)", "CNC-Fräsen"],
      rows: [
        ["Geometriefreiheit", "sehr hoch, Hohlräume möglich", "durch Werkzeugzugang begrenzt"],
        ["Toleranzen", "typisch ±0.2 mm", "deutlich enger möglich"],
        ["Materialien", "Kunststoffe, Resin", "Kunststoffe und Metalle"],
        ["Rüstaufwand", "gering", "höher (Programmierung, Spannen)"],
        ["Stückkosten klein", "günstig", "höher"],
        ["Lieferzeit", "kurz (Standard 48 h Produktion)", "länger"],
      ],
    },
    sections: [
      {
        title: "3D-Druck wählen, wenn …",
        bullets: [
          "die Geometrie komplex oder organisch ist",
          "nur wenige Teile gebraucht werden",
          "es schnell gehen muss",
          "Kunststoff als Material genügt",
        ],
      },
      {
        title: "CNC wählen, wenn …",
        text: "Toleranzen im Hundertstelbereich, metallische Werkstoffe oder maximale Festigkeit gefordert sind. Wir bieten kein CNC-Fräsen an – wenn dein Teil das braucht, sagen wir es dir offen statt eine Druckvariante zu empfehlen, die nicht passt.",
      },
    ],
    faqs: [
      { q: "Bietet 3DMuscio CNC-Fräsen an?", a: "Nein, wir fertigen im FDM- und SLA-Verfahren. Bei Metall- oder Präzisionsteilen sagen wir dir das ehrlich." },
      { q: "Wie genau ist der 3D-Druck?", a: "Typisch ±0.2 mm. Bei engeren Anforderungen stimmen wir Orientierung und Qualitätsstufe vorher ab." },
    ],
    related: [
      { label: "Prototypen", to: "/leistungen/3d-druck-prototypen" },
      { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien" },
      { label: "Kosten", to: "/wissen/3d-druck-kosten-schweiz" },
    ],
  },
  {
    slug: "3d-druck-vs-spritzguss",
    h1: "3D-Druck vs Spritzguss – ab wann lohnt sich die Form?",
    title: "3D-Druck vs Spritzguss: Vergleich | 3DMuscio",
    description:
      "3D-Druck oder Spritzguss? Werkzeugkosten, Stückkosten, Stückzahlgrenzen und Flexibilität im Vergleich – Orientierungshilfe von 3DMuscio.",
    shortAnswer:
      "Kurz gesagt: Spritzguss ist bei grossen Stückzahlen pro Teil unschlagbar günstig, verlangt aber eine teure Form und eine fixe Geometrie. 3D-Druck hat keine Werkzeugkosten und erlaubt Änderungen jederzeit – deshalb ist er für Prototypen, Kleinserien und Ersatzteile die wirtschaftlichere Wahl.",
    table: {
      headers: ["Kriterium", "3D-Druck", "Spritzguss"],
      rows: [
        ["Werkzeugkosten", "keine", "hoch (Form)"],
        ["Stückkosten klein", "günstig", "sehr hoch"],
        ["Stückkosten gross", "höher", "sehr günstig"],
        ["Designänderungen", "jederzeit, kostenlos", "nur mit neuer/geänderter Form"],
        ["Vorlaufzeit", "Tage", "Wochen bis Monate"],
        ["Sinnvoll ab", "1 Stück", "grosse Serien"],
      ],
    },
    sections: [
      {
        title: "Der wirtschaftliche Kipppunkt",
        text: "Solange die Formkosten nicht auf genügend Teile verteilt werden können, ist der 3D-Druck günstiger. Wo genau der Kipppunkt liegt, hängt von Bauteilgrösse, Geometrie und Formkosten ab – bei kleinen Teilen liegt er höher, bei grossen früher. Rechne beide Wege durch, bevor du in eine Form investierst.",
      },
      {
        title: "Der pragmatische Weg",
        bullets: [
          "Prototypen und Nullserie im 3D-Druck testen",
          "Markt mit einer Kleinserie validieren",
          "Erst danach über eine Form entscheiden",
          "Ersatz- und Nachserienteile weiter drucken",
        ],
      },
    ],
    faqs: [
      { q: "Bietet 3DMuscio Spritzguss an?", a: "Nein. Wir fertigen im 3D-Druck und sagen dir, wenn eine Serienfertigung für dich sinnvoller wäre." },
      { q: "Sind gedruckte Teile so gut wie Spritzgussteile?", a: "Nicht identisch, aber für viele Anwendungen ausreichend. Entscheidend sind Material, Wandstärke und Druckrichtung." },
    ],
    related: [
      { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien" },
      { label: "3D-Druck vs CNC", to: "/vergleich/3d-druck-vs-cnc" },
      { label: "Kosten", to: "/wissen/3d-druck-kosten-schweiz" },
    ],
  },
];

export const getComparison = (slug?: string) => comparisons.find((c) => c.slug === slug);
