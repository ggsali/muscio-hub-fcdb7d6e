import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export interface PublicReview {
  id: string;
  customer_name: string;
  kommentar: string | null;
  rating: number;
  created_at: string;
}

export interface PublicReviewData {
  /** Anzahl aller sichtbaren Bewertungen */
  count: number;
  /** Durchschnitt über alle sichtbaren Bewertungen (eine Nachkommastelle) */
  average: number;
  /** Neueste Bewertungen mit gekürztem Namen (z. B. «Bernhard M.») */
  reviews: PublicReview[];
}

export const EMPTY_REVIEW_DATA: PublicReviewData = { count: 0, average: 0, reviews: [] };

/** «Bernhard Muhr» -> «Bernhard M.»; Zusatz nach « · » (z. B. Rolle) bleibt erhalten. */
export function shortName(full: string): string {
  const [namePart, ...rest] = (full || "").split(" · ");
  const words = namePart.trim().split(/\s+/).filter(Boolean);
  const short =
    words.length >= 2 ? `${words[0]} ${words[words.length - 1].charAt(0).toUpperCase()}.` : words[0] || "Kunde";
  return [short, ...rest].join(" · ");
}

/** Öffentliche, freigegebene Bewertungen (nur über die View public_reviews, nie mit Admin-Rechten). */
export async function readPublicReviewData(): Promise<PublicReviewData> {
  try {
    const url = process.env["SUPABASE_URL"] || import.meta.env.VITE_SUPABASE_URL;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return EMPTY_REVIEW_DATA;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data, error } = await client
      .from("public_reviews")
      .select("id, customer_name, kommentar, rating, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !data) return EMPTY_REVIEW_DATA;
    const rows = (data as PublicReview[]).filter((r) => Number.isFinite(Number(r.rating)));
    if (rows.length === 0) return EMPTY_REVIEW_DATA;
    const average = Math.round((rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length) * 10) / 10;
    return {
      count: rows.length,
      average,
      reviews: rows.slice(0, 9).map((r) => ({ ...r, customer_name: shortName(r.customer_name) })),
    };
  } catch {
    return EMPTY_REVIEW_DATA;
  }
}

export const getPublicReviewData = createServerFn({ method: "GET" }).handler(readPublicReviewData);
