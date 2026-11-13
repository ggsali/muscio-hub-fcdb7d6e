// Adressformat für Versandetiketten, international (Postleitzahl-Reihenfolge je Land)
export interface LabelAdresse {
  name: string; firma: string; zusatz: string; strasse: string;
  plz: string; ort: string; region: string; land: string; telefon: string;
}
export const LEERE_ADRESSE: LabelAdresse = {
  name: "", firma: "", zusatz: "", strasse: "", plz: "", ort: "", region: "", land: "", telefon: "",
};

export interface Land { iso: string; de: string; en: string }
export const LAENDER: Land[] = [
  { iso: "CH", de: "Schweiz", en: "Switzerland" },
  { iso: "LI", de: "Liechtenstein", en: "Liechtenstein" },
  { iso: "DE", de: "Deutschland", en: "Germany" },
  { iso: "AT", de: "Österreich", en: "Austria" },
  { iso: "FR", de: "Frankreich", en: "France" },
  { iso: "IT", de: "Italien", en: "Italy" },
  { iso: "ES", de: "Spanien", en: "Spain" },
  { iso: "PT", de: "Portugal", en: "Portugal" },
  { iso: "NL", de: "Niederlande", en: "Netherlands" },
  { iso: "BE", de: "Belgien", en: "Belgium" },
  { iso: "LU", de: "Luxemburg", en: "Luxembourg" },
  { iso: "GB", de: "Vereinigtes Königreich", en: "United Kingdom" },
  { iso: "IE", de: "Irland", en: "Ireland" },
  { iso: "DK", de: "Dänemark", en: "Denmark" },
  { iso: "SE", de: "Schweden", en: "Sweden" },
  { iso: "NO", de: "Norwegen", en: "Norway" },
  { iso: "FI", de: "Finnland", en: "Finland" },
  { iso: "IS", de: "Island", en: "Iceland" },
  { iso: "PL", de: "Polen", en: "Poland" },
  { iso: "CZ", de: "Tschechien", en: "Czech Republic" },
  { iso: "SK", de: "Slowakei", en: "Slovakia" },
  { iso: "HU", de: "Ungarn", en: "Hungary" },
  { iso: "SI", de: "Slowenien", en: "Slovenia" },
  { iso: "HR", de: "Kroatien", en: "Croatia" },
  { iso: "RO", de: "Rumänien", en: "Romania" },
  { iso: "BG", de: "Bulgarien", en: "Bulgaria" },
  { iso: "GR", de: "Griechenland", en: "Greece" },
  { iso: "EE", de: "Estland", en: "Estonia" },
  { iso: "LV", de: "Lettland", en: "Latvia" },
  { iso: "LT", de: "Litauen", en: "Lithuania" },
  { iso: "TR", de: "Türkei", en: "Turkey" },
  { iso: "US", de: "Vereinigte Staaten", en: "United States" },
  { iso: "CA", de: "Kanada", en: "Canada" },
  { iso: "MX", de: "Mexiko", en: "Mexico" },
  { iso: "BR", de: "Brasilien", en: "Brazil" },
  { iso: "AU", de: "Australien", en: "Australia" },
  { iso: "NZ", de: "Neuseeland", en: "New Zealand" },
  { iso: "JP", de: "Japan", en: "Japan" },
  { iso: "CN", de: "China", en: "China" },
  { iso: "KR", de: "Südkorea", en: "South Korea" },
  { iso: "SG", de: "Singapur", en: "Singapore" },
  { iso: "AE", de: "Vereinigte Arabische Emirate", en: "United Arab Emirates" },
  { iso: "IL", de: "Israel", en: "Israel" },
  { iso: "ZA", de: "Südafrika", en: "South Africa" },
  { iso: "IN", de: "Indien", en: "India" },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").trim();

export function findLand(text: string): Land | undefined {
  const t = norm(text || "");
  if (!t) return undefined;
  const alias: Record<string, string> = { usa: "US", "u.s.a.": "US", uk: "GB", "great britain": "GB", england: "GB", "grossbritannien": "GB", suisse: "CH", svizzera: "CH", schweiz: "CH" };
  const iso = alias[t];
  return LAENDER.find((l) => (iso ? l.iso === iso : false) || l.iso.toLowerCase() === t || norm(l.de) === t || norm(l.en) === t);
}

/** Adresszeilen inkl. Landzeile (Zielland gross, auf Englisch, ausser Inland). */
export function adressZeilen(a: LabelAdresse, herkunftIso = "CH"): string[] {
  const land = findLand(a.land);
  const iso = land?.iso ?? "";
  const plz = a.plz.trim(), ort = a.ort.trim(), reg = a.region.trim();
  let ortZeile: string;
  if (iso === "US") ortZeile = [ort, [reg, plz].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  else if (iso === "CA") ortZeile = [ort, [reg, plz].filter(Boolean).join("  ")].filter(Boolean).join(" ");
  else if (iso === "AU" || iso === "NZ") ortZeile = [ort, reg, plz].filter(Boolean).join(" ");
  else if (iso === "GB" || iso === "IE") ortZeile = [ort, reg].filter(Boolean).join(", ");
  else ortZeile = [plz, ort].filter(Boolean).join(" ");

  const zeilen = [a.name, a.firma, a.zusatz, a.strasse, ortZeile].map((z) => z.trim()).filter(Boolean);
  if ((iso === "GB" || iso === "IE") && plz) zeilen.push(plz.toUpperCase());
  const landName = land ? (iso === herkunftIso ? "" : land.en) : a.land.trim();
  if (landName) zeilen.push(landName.toUpperCase());
  return zeilen;
}

export function absenderZeilen(a: LabelAdresse): string[] {
  const land = findLand(a.land);
  return [a.firma || a.name, a.firma ? a.name : "", a.strasse, [a.plz, a.ort].filter(Boolean).join(" "), land?.iso === "CH" ? "" : (land?.en ?? a.land)]
    .map((z) => z.trim()).filter(Boolean);
}
