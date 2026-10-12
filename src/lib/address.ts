/**
 * Hilfsfunktionen für Schweizer/deutsche Strassenadressen.
 * Ziel: Strassenname und Hausnummer landen in getrennten Feldern
 * ("Musterstrasse" + "12a"), nicht zusammen im Strassenfeld.
 *
 * Hinweis: Eine Kopie dieser Logik liegt in
 * supabase/functions/_shared/address.ts (Edge-Functions können nicht aus src/ importieren).
 */

export interface StreetParts {
  strasse: string;
  hausnummer: string;
}

// Hausnummer am Ende: 12, 12a, 12 a, 12-14, 12/3, 12b-14
const NR = "\\d+(?:\\s?[a-zA-Z])?(?:\\s?[-/]\\s?\\d+(?:\\s?[a-zA-Z])?)?";
const WITH_SPACE = new RegExp(`^(.*?\\S)\\s+(${NR})$`);
const WITHOUT_SPACE = new RegExp(`^(.*?[^\\d\\s\\-/])(\\d+[a-zA-Z]?)$`);

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Trennt "Musterstrasse 12a" in { strasse: "Musterstrasse", hausnummer: "12a" }. */
export function splitStreet(raw: string | null | undefined): StreetParts {
  const s = clean(raw);
  if (!s) return { strasse: "", hausnummer: "" };

  const m = s.match(WITH_SPACE);
  if (m) return { strasse: m[1], hausnummer: m[2].replace(/\s+/g, "") };

  // "Musterstrasse12" (ohne Leerzeichen), nur bei sinnvollem Strassennamen
  const m2 = s.match(WITHOUT_SPACE);
  if (m2 && /[a-zA-ZÀ-ÿ]{3,}/.test(m2[1])) return { strasse: m2[1], hausnummer: m2[2] };

  return { strasse: s, hausnummer: "" };
}

/**
 * Bringt Strasse/Nr. in die richtige Form:
 * - Nr. leer und Strasse endet auf eine Nummer  -> Nummer ins Nr.-Feld verschieben
 * - Strasse endet bereits auf die Nr.            -> Doppelung entfernen
 * - sonst unverändert (nur Leerzeichen bereinigt)
 */
export function normalizeStreet(strasse: string | null | undefined, hausnummer: string | null | undefined): StreetParts {
  const st = clean(strasse);
  const nr = clean(hausnummer);

  if (!nr) return splitStreet(st);

  if (st) {
    const split = splitStreet(st);
    if (split.hausnummer && split.hausnummer.toLowerCase() === nr.replace(/\s+/g, "").toLowerCase()) {
      return { strasse: split.strasse, hausnummer: nr };
    }
  }
  return { strasse: st, hausnummer: nr };
}

/** Setzt Strasse und Nr. wieder zu einer Zeile zusammen: "Musterstrasse 12a". */
export function joinStreet(strasse: string | null | undefined, hausnummer: string | null | undefined): string {
  const { strasse: s, hausnummer: n } = normalizeStreet(strasse, hausnummer);
  return [s, n].filter(Boolean).join(" ");
}
