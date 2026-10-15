import { useMatches } from "@tanstack/react-router";
import { getPublicReviewData, type PublicReviewData } from "@/lib/reviews.functions";

/** Bewertungen aus dem Route-Loader (serverseitig gerendert). Liefert null, wenn die Route keinen Loader hat. */
export function useReviewData(): PublicReviewData | null {
  const matches = useMatches();
  for (const m of matches) {
    const d = (m.loaderData as { reviewData?: PublicReviewData } | undefined)?.reviewData;
    if (d) return d;
  }
  return null;
}

/** Loader für Routen mit Bewertungen */
export const reviewLoader = async () => {
  return { reviewData: await getPublicReviewData() };
};
