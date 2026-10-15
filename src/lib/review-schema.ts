import type { OrgRatingData } from "@/lib/organization-schema";

type ReviewData = {
  count: number;
  average: number;
  reviews: { customer_name: string; rating: number; kommentar: string | null; created_at: string }[];
};

/** AggregateRating/Review ausschliesslich aus den echten, auf der Seite sichtbaren Bewertungen. */
export function buildRatingSchema(data?: ReviewData | null): OrgRatingData {
  if (!data || data.count <= 0) return {};
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: data.average,
      reviewCount: data.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: data.reviews
      .filter((r) => (r.kommentar ?? "").trim().length > 0)
      .slice(0, 5)
      .map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.customer_name.split(" · ")[0] },
        datePublished: r.created_at.slice(0, 10),
        reviewBody: r.kommentar,
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
  };
}
