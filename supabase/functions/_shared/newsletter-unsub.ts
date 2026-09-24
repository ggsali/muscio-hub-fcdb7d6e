// Signierte Abmelde-Token für den Newsletter (HMAC über die E-Mail-Adresse).
// Verhindert, dass beliebige Adressen ohne Nachweis abgemeldet werden können.
import { createHmac } from "node:crypto";

function secret(): string {
  return (
    Deno.env.get("NEWSLETTER_UNSUB_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Erzeugt das Abmelde-Token für eine E-Mail-Adresse. */
export function unsubToken(email: string): string {
  return createHmac("sha256", secret())
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 32);
}

/** Prüft ein Abmelde-Token gegen die E-Mail-Adresse. */
export function verifyUnsubToken(email: string, token: unknown): boolean {
  if (typeof token !== "string" || !token) return false;
  const expected = unsubToken(email);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

/** Signatur für Tracking-Links (bindet den Link an die Empfänger-ID). */
export function trackSig(id: string): string {
  return createHmac("sha256", secret()).update(`track:${id}`).digest("hex").slice(0, 24);
}

export function verifyTrackSig(id: string, sig: unknown): boolean {
  if (typeof sig !== "string" || !sig) return false;
  const expected = trackSig(id);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
