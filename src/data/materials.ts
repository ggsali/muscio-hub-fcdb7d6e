export interface Material {
  id: string;
  name: string;
  type: "FDM" | "SLA" | "Flexibel";
  pricePerGram: number;
  color: string;
  description: string;
  temperature: string;
  flexibility: number;
  detail: number;
  priceRating: number;
  useCases: string[];
  density: number;
}

export const materials: Material[] = [
  {
    id: "pla", name: "PLA", type: "FDM", pricePerGram: 0.04, color: "#4CAF50",
    description: "Biologisch abbaubar und einfach zu drucken. Ideal für Prototypen und dekorative Objekte.",
    temperature: "190–220°C", flexibility: 1, detail: 3, priceRating: 1,
    useCases: ["Prototypen", "Dekoration", "Modelle", "Bildung"], density: 1.24,
  },
  {
    id: "petg", name: "PETG", type: "FDM", pricePerGram: 0.06, color: "#2196F3",
    description: "Stark und chemisch beständig. Perfekt für mechanische Teile und Outdoor-Anwendungen.",
    temperature: "220–250°C", flexibility: 2, detail: 3, priceRating: 2,
    useCases: ["Mechanik", "Gehäuse", "Outdoor", "Lebensmittelkontakt"], density: 1.27,
  },
  {
    id: "abs", name: "ABS", type: "FDM", pricePerGram: 0.05, color: "#FF9800",
    description: "Hitzebeständig und schlagfest. Standard für industrielle Anwendungen.",
    temperature: "230–260°C", flexibility: 2, detail: 3, priceRating: 2,
    useCases: ["Industrie", "Automotive", "Gehäuse", "Werkzeuge"], density: 1.04,
  },
  {
    id: "asa", name: "ASA", type: "FDM", pricePerGram: 0.07, color: "#795548",
    description: "UV-beständig und wetterfest. Die bessere Alternative zu ABS für den Ausseneinsatz.",
    temperature: "240–260°C", flexibility: 2, detail: 3, priceRating: 3,
    useCases: ["Outdoor", "Automotive", "Garten", "Beschilderung"], density: 1.07,
  },
  {
    id: "tpu", name: "TPU", type: "Flexibel", pricePerGram: 0.08, color: "#9C27B0",
    description: "Flexibel und gummiartig. Perfekt für Dichtungen, Hüllen und stoßdämpfende Teile.",
    temperature: "210–230°C", flexibility: 5, detail: 2, priceRating: 3,
    useCases: ["Dichtungen", "Hüllen", "Stossdämpfer", "Schuhsohlen"], density: 1.21,
  },
  {
    id: "pva", name: "PVA", type: "FDM", pricePerGram: 0.10, color: "#FFEB3B",
    description: "Wasserlösliches Stützmaterial. Löst sich in Wasser auf für perfekte Überhänge.",
    temperature: "180–200°C", flexibility: 1, detail: 4, priceRating: 4,
    useCases: ["Stützmaterial", "Komplexe Geometrien"], density: 1.23,
  },
  {
    id: "hips", name: "HIPS", type: "FDM", pricePerGram: 0.05, color: "#E0E0E0",
    description: "Leichtgewichtiger Kunststoff. Löslich in Limonen als Stützstruktur.",
    temperature: "220–240°C", flexibility: 1, detail: 3, priceRating: 2,
    useCases: ["Stützmaterial", "Verpackung", "Leichtbau"], density: 1.04,
  },
  {
    id: "resin-standard", name: "Resin Standard", type: "SLA", pricePerGram: 0.12, color: "#B0BEC5",
    description: "Höchste Detailgenauigkeit und glatte Oberflächen. Ideal für Miniaturen und Schmuck.",
    temperature: "N/A", flexibility: 1, detail: 5, priceRating: 4,
    useCases: ["Miniaturen", "Schmuck", "Dental", "Präzision"], density: 1.10,
  },
  {
    id: "resin-abs", name: "Resin ABS-like", type: "SLA", pricePerGram: 0.14, color: "#546E7A",
    description: "Kombination aus SLA-Detail und ABS-ähnlicher Festigkeit.",
    temperature: "N/A", flexibility: 2, detail: 5, priceRating: 5,
    useCases: ["Funktionsteile", "Snap-Fits", "Prototypen"], density: 1.12,
  },
  {
    id: "resin-flex", name: "Resin Flexible", type: "SLA", pricePerGram: 0.15, color: "#26A69A",
    description: "Flexibles Harz mit hoher Detailauflösung. Gummiartig bei feiner Oberfläche.",
    temperature: "N/A", flexibility: 4, detail: 5, priceRating: 5,
    useCases: ["Prototypen", "Dichtungen", "Medizin"], density: 1.15,
  },
  {
    id: "nylon", name: "Nylon", type: "FDM", pricePerGram: 0.09, color: "#FAFAFA",
    description: "Extrem zäh und belastbar. Für anspruchsvolle mechanische Anwendungen.",
    temperature: "250–270°C", flexibility: 3, detail: 3, priceRating: 3,
    useCases: ["Zahnräder", "Scharniere", "Lager", "Werkzeuge"], density: 1.14,
  },
  {
    id: "cf-pla", name: "Carbon-Fiber PLA", type: "FDM", pricePerGram: 0.11, color: "#37474F",
    description: "Kohlefaserverstärktes PLA. Leicht und steif mit edler Optik.",
    temperature: "200–230°C", flexibility: 1, detail: 3, priceRating: 4,
    useCases: ["Drohnen", "RC-Teile", "Leichtbau", "Design"], density: 1.30,
  },
];

export const calculatorMaterials = materials.filter(m =>
  ["pla", "petg", "abs", "tpu", "resin-standard"].includes(m.id)
);
