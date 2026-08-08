import { Helmet } from "react-helmet-async";

const SITE_URL = "https://3dmuscio.com";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/HMfId6YGEQSzYkPI7XRIdUZpU013/social-images/social-1777546828436-file_1770761597489.webp";

interface SeoProps {
  title: string;
  description: string;
  /** Route path, e.g. "/prototypen" */
  path: string;
  image?: string;
  type?: "website" | "article" | "product";
  /** Optional JSON-LD object(s) for this page */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Per-Route Head-Tags (Title, Description, Open Graph, Twitter Card).
 * Canonical wird global über CanonicalTag gesetzt (self-referencing pro Route).
 */
export const Seo = ({ title, description, path, image = DEFAULT_IMAGE, type = "website", jsonLd }: SeoProps) => {
  const url = `${SITE_URL}${path === "/" ? "/" : path.replace(/\/$/, "")}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="3DMuscio" />
      <meta property="og:locale" content="de_CH" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(b)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
