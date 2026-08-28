// Läuft vor `vite dev` und `vite build` (predev/prebuild) und schreibt public/sitemap.xml.
// Statische Routen kommen aus der Liste unten, dynamische Inhalte (Blog, Projekte, Shop)
// werden über die Lovable-Cloud-REST-API geladen – mit denselben Filtern wie die Seiten.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

const BASE_URL = "https://3dmuscio.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const materialSlugs = ["pla", "petg", "abs", "asa", "tpu", "nylon", "resin"];
const serviceSlugs = [
  "fdm-3d-druck",
  "sla-3d-druck",
  "3d-druck-prototypen",
  "3d-druck-ersatzteile",
  "3d-druck-kleinserien",
];
const comparisonSlugs = [
  "pla-vs-petg",
  "petg-vs-abs",
  "abs-vs-asa",
  "fdm-vs-sla",
  "resin-vs-fdm",
  "3d-druck-vs-cnc",
  "3d-druck-vs-spritzguss",
];
const locationSlugs = ["thurgau", "ostschweiz", "zuerich", "st-gallen"];

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/kalkulator-online", changefreq: "weekly", priority: "0.9" },
  { path: "/leistungen", changefreq: "monthly", priority: "0.9" },
  ...serviceSlugs.map((s): SitemapEntry => ({ path: `/leistungen/${s}`, changefreq: "monthly", priority: "0.9" })),
  { path: "/prototypen", changefreq: "monthly", priority: "0.8" },
  { path: "/ersatzteile", changefreq: "monthly", priority: "0.8" },
  { path: "/kleinserien", changefreq: "monthly", priority: "0.8" },
  { path: "/materialien", changefreq: "monthly", priority: "0.9" },
  ...materialSlugs.map((s): SitemapEntry => ({ path: `/materialien/${s}`, changefreq: "monthly", priority: "0.8" })),
  { path: "/vergleich", changefreq: "monthly", priority: "0.7" },
  ...comparisonSlugs.map((s): SitemapEntry => ({ path: `/vergleich/${s}`, changefreq: "monthly", priority: "0.8" })),
  { path: "/wissen/3d-druck-kosten-schweiz", changefreq: "monthly", priority: "0.9" },
  ...locationSlugs.map((s): SitemapEntry => ({ path: `/standorte/${s}`, changefreq: "monthly", priority: "0.7" })),
  { path: "/shop", changefreq: "weekly", priority: "0.8" },
  { path: "/maschinen", changefreq: "monthly", priority: "0.6" },
  { path: "/ueber-uns", changefreq: "monthly", priority: "0.6" },
  { path: "/ueber-ki", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/kontakt", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/bewertung", changefreq: "yearly", priority: "0.3" },
  { path: "/impressum", changefreq: "yearly", priority: "0.3" },
  { path: "/datenschutz", changefreq: "yearly", priority: "0.3" },
  { path: "/agb", changefreq: "yearly", priority: "0.3" },
];

/** .env lesen, damit das Script auch ohne geladene Umgebung funktioniert */
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf-8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${key}=`));
  return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
}

async function fetchDynamic(): Promise<SitemapEntry[]> {
  const url = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) {
    console.warn("sitemap: keine Backend-Zugangsdaten gefunden – nur statische Routen");
    return [];
  }

  const query = async (table: string, params: string): Promise<Record<string, string>[]> => {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        console.warn(`sitemap: ${table} nicht lesbar (${res.status})`);
        return [];
      }
      return (await res.json()) as Record<string, string>[];
    } catch (e) {
      console.warn(`sitemap: ${table} konnte nicht geladen werden`, e);
      return [];
    }
  };

  const [posts, projects, products] = await Promise.all([
    query("blog_posts", "select=slug&veroeffentlicht=eq.true"),
    query("projekte", "select=slug&aktiv=eq.true"),
    query("shop_products", "select=slug&aktiv=eq.true"),
  ]);

  const entries: SitemapEntry[] = [];
  posts.forEach((p) => p.slug && entries.push({ path: `/blog/${p.slug}`, changefreq: "monthly", priority: "0.6" }));
  projects.forEach((p) => p.slug && entries.push({ path: `/projekte/${p.slug}`, changefreq: "monthly", priority: "0.6" }));
  products.forEach((p) => p.slug && entries.push({ path: `/shop/${p.slug}`, changefreq: "weekly", priority: "0.7" }));
  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const dynamic = await fetchDynamic();
const seen = new Set<string>();
const all = [...staticEntries, ...dynamic].filter((e) => {
  if (seen.has(e.path)) return false;
  seen.add(e.path);
  return true;
});

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
console.log(`sitemap.xml written (${all.length} entries, ${dynamic.length} dynamisch)`);
