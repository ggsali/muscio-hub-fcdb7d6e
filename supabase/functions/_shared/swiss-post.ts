/**
 * Swiss Post Digital Commerce API – Barcode (generateAddressLabel).
 * Reine Hilfsfunktionen ohne Netzwerkzugriff, damit sie sich testen lassen.
 *
 * Quelle der Feldnamen: OpenAPI-Modell der Barcode-API v1
 * (language, frankingLicense, ppFranking, customer, customerSystem, labelDefinition, item;
 *  Antwort: item.identCode, item.label[], item.errors, item.warnings).
 */

export const POST_TOKEN_URL = "https://api.post.ch/OAuth/token";
export const POST_LABEL_URL = "https://dcapi.apis.post.ch/barcode/v1/generateAddressLabel";
export const POST_SCOPE = "DCAPI_BARCODE_READ";

const COUNTRIES: Record<string, string> = {
  schweiz: "CH", switzerland: "CH", suisse: "CH", svizzera: "CH",
  deutschland: "DE", germany: "DE", allemagne: "DE",
  "österreich": "AT", oesterreich: "AT", austria: "AT", autriche: "AT",
  liechtenstein: "LI",
  frankreich: "FR", france: "FR",
  italien: "IT", italy: "IT", italia: "IT",
  spanien: "ES", spain: "ES",
  niederlande: "NL", netherlands: "NL",
  belgien: "BE", belgium: "BE",
  luxemburg: "LU", luxembourg: "LU",
  "vereinigtes königreich": "GB", grossbritannien: "GB", "united kingdom": "GB",
  usa: "US", "vereinigte staaten": "US",
};

/** "Schweiz" -> "CH". Zwei Buchstaben gelten als bereits gültiger Ländercode. Unbekannt -> null. */
export function countryToIso(land: string | null | undefined): string | null {
  const raw = (land ?? "").trim();
  if (!raw) return "CH";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRIES[raw.toLowerCase()] ?? null;
}

export interface LabelAddress {
  name1: string;
  name2?: string;
  street: string;
  houseNo?: string;
  zip: string;
  city: string;
  country: string;
}

export interface LabelRequestInput {
  frankingLicense: string;
  produkt: string; // Servicecode (PRZL), z. B. PRI, ECO
  testMode: boolean; // true = SPECIMEN-Etikette, kostet nichts und ist nicht versandgültig
  labelLayout: string; // z. B. A6
  itemId: string;
  sender: Omit<LabelAddress, "houseNo" | "name2"> & { name2?: string };
  recipient: LabelAddress;
}

/** Prüft die Adresse und gibt eine verständliche Fehlermeldung zurück (oder null). */
export function validateAddress(a: LabelAddress, who: string): string | null {
  if (!a.name1?.trim()) return `${who}: Name fehlt`;
  if (!a.street?.trim()) return `${who}: Strasse fehlt`;
  if (!a.zip?.trim()) return `${who}: PLZ fehlt`;
  if (!a.city?.trim()) return `${who}: Ort fehlt`;
  if (a.country === "CH" && !/^\d{4}$/.test(a.zip.trim())) return `${who}: Schweizer PLZ muss 4 Ziffern haben (aktuell "${a.zip}")`;
  return null;
}

const omitEmpty = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T;

/** Baut den JSON-Body für POST /barcode/v1/generateAddressLabel. */
export function buildGenerateLabelRequest(i: LabelRequestInput) {
  return {
    language: "DE",
    frankingLicense: i.frankingLicense,
    ppFranking: false,
    customerSystem: "3dMuscio",
    customer: omitEmpty({
      name1: i.sender.name1,
      name2: i.sender.name2,
      street: i.sender.street, // beim Absender steht die Hausnummer in "street"
      zip: i.sender.zip,
      city: i.sender.city,
      country: i.sender.country,
    }),
    labelDefinition: {
      labelLayout: i.labelLayout,
      printAddresses: "RECIPIENT_AND_CUSTOMER",
      imageFileType: "PDF",
      imageResolution: 300,
      printPreview: i.testMode,
    },
    item: {
      itemID: i.itemId,
      recipient: omitEmpty({
        name1: i.recipient.name1,
        name2: i.recipient.name2,
        street: i.recipient.street,
        houseNo: i.recipient.houseNo,
        zip: i.recipient.zip,
        city: i.recipient.city,
        country: i.recipient.country,
      }),
      attributes: { przl: [i.produkt] },
    },
  };
}

export interface LabelResult {
  label: string | null; // Base64-PDF
  identCode: string | null; // Sendungsnummer
  errors: unknown;
  warnings: unknown;
}

const hasContent = (v: unknown) =>
  v != null && (typeof v !== "object" || Object.keys(v as object).length > 0) && !(Array.isArray(v) && v.length === 0);

/** Liest Etikette, Sendungsnummer und Meldungen aus der Antwort der Post. */
export function extractLabelResult(json: any): LabelResult {
  const item = json?.item ?? json?.Item ?? null;
  const labelRaw = item?.label;
  const label = Array.isArray(labelRaw) ? (labelRaw[0] ?? null) : (typeof labelRaw === "string" ? labelRaw : null);
  const ident = typeof item?.identCode === "string" ? item.identCode.replace(/\s+/g, "") : null;
  return {
    label: label || null,
    identCode: ident || null,
    errors: hasContent(item?.errors) ? item.errors : null,
    warnings: hasContent(item?.warnings) ? item.warnings : null,
  };
}
