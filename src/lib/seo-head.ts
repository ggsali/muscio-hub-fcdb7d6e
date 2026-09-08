/**
 * Head-Metadaten für serverseitig gerenderte Seiten.
 * Wichtig: Diese Tags stehen bereits im Server-HTML, damit Google und
 * AI-Crawler pro Seite eindeutige Titel/Descriptions sehen.
 */

const SITE_URL = "https://3dmuscio.com";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/HMfId6YGEQSzYkPI7XRIdUZpU013/social-images/social-1777546828436-file_1770761597489.webp";

export function buildHead(opts: {
  title: string;
  description: string;
  /** Route-Pfad, z. B. "/leistungen/sla-3d-druck" */
  path: string;
  type?: "website" | "article" | "product";
  image?: string;
}) {
  const url = `${SITE_URL}${opts.path === "/" ? "/" : opts.path.replace(/\/$/, "")}`;
  const image = opts.image ?? DEFAULT_IMAGE;
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:type", content: opts.type ?? "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", hrefLang: "de-CH", href: url },
    ],
  };
}
