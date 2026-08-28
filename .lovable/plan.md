# SEO & GEO Masterplan 3DMuscio – Umsetzungsplan

Ziel: bestehende Website behalten (Design, Branding, URLs, Funktionen) und sie technisch, strukturell und inhaltlich so ausbauen, dass Google **und** AI-Antwortmaschinen (AI Overviews, ChatGPT Search, Perplexity, Copilot, Gemini) 3DMuscio klar als 3D-Druckservice in Eschlikon TG / Schweiz erkennen und zitieren.

Grundregeln über alle Phasen:
- Keine bestehenden Seiten oder Inhalte löschen, keine URL ändern (nur ergänzen).
- Keine erfundenen Fakten. Fehlende Angaben werden als `[INFORMATION VON 3DMUSCIO ERFORDERLICH]` markiert und mir im Report gemeldet.
- Kein generischer AI-Textmüll; jede neue Seite muss eine echte Kundenfrage beantworten.

---

## Phase 1 – Audit (1 Schritt, kein Code)

Vollständige Bestandsaufnahme und Bericht in der Chat-Antwort:
- Alle öffentlichen Routen (aktuell u. a. `/`, `/leistungen`, `/ersatzteile`, `/prototypen`, `/kleinserien`, `/materialien`, `/maschinen`, `/faq`, `/kontakt`, `/blog`, `/shop`, `/kalkulator-online`, `/ueber-uns`, `/ueber-ki`, Rechtsseiten).
- Pro Seite: Title, Meta Description, H1-Anzahl, Canonical, Schema, interne Links, Wortumfang.
- Lückenliste: Content-, AI-Search-, Local-SEO-, Schema-, Linking- und Conversion-Lücken.
- Prüfung Sitemap (`public/sitemap.xml`, aktuell statisch), `robots.txt`, `llms.txt`.

Ergebnis: priorisierte Problemliste, die die Phasen 3.x steuert.

## Phase 2 – Informationsarchitektur

Neue Struktur festlegen, ohne bestehende URLs anzutasten:

```text
/                        Entity + Hauptintention "3D-Druckservice Schweiz"
/leistungen              Hub (bleibt) -> verlinkt neue Unterseiten
  /leistungen/fdm-3d-druck
  /leistungen/sla-3d-druck
  /leistungen/3d-druck-prototypen      (Kanonisch; /prototypen verlinkt darauf)
  /leistungen/3d-druck-ersatzteile     (Kanonisch; /ersatzteile verlinkt darauf)
  /leistungen/3d-druck-kleinserien     (Kanonisch; /kleinserien verlinkt darauf)
/materialien             Hub (bleibt)
  /materialien/:slug     PLA, PETG, ABS/ASA, TPU, Resin – nur real angebotene
/vergleich/:slug         PLA vs PETG, PETG vs ABS, FDM vs SLA, 3D-Druck vs Spritzguss, 3D-Druck vs CNC
/wissen/3d-druck-kosten-schweiz
/standorte/:slug         Thurgau, Zürich, St. Gallen, Ostschweiz (nur echte Liefergebiete)
```

Duplicate Content: bestehende `/prototypen`, `/ersatzteile`, `/kleinserien` bleiben live als Conversion-Seiten, die neuen `/leistungen/*`-Seiten sind die tiefen Informationsseiten – klare Themenabgrenzung + Canonicals, damit sich beide nicht kannibalisieren.

## Phase 3 – Implementierung (in dieser Reihenfolge)

**3.1 Technisches Fundament**
- `src/components/site/Seo.tsx` erweitern: eindeutige Title/Description, Canonical, OG/Twitter, `hreflang="de-CH"`, optionales `noindex`.
- Sitemap-Generator `scripts/generate-sitemap.ts` + `predev`/`prebuild`-Hooks, damit statische Routen **und** dynamische Inhalte (Blogposts, Projekte, Shop, Materialien) automatisch enthalten sind. Der statische `public/sitemap.xml` wird dabei durch den Generator ersetzt – bitte bestätigen.
- `robots.txt` prüfen/ergänzen (Admin-, Portal-, Token-Routen ausschliessen).
- `llms.txt` / `llms-full.txt` mit finaler Entity-Beschreibung und Seitenindex aktualisieren.

**3.2 Entity & Schema**
- Zentrale Datenquelle `src/data/company.ts` (Name, Kategorie, Adresse Eschlikon TG, Zielmarkt, Zielgruppen, Verfahren, Materialien, Lieferzeiten) – wird von Seiten, Schema und Footer gemeinsam genutzt, damit die Angaben überall identisch sind.
- JSON-LD: `LocalBusiness`/`Organization` global, dazu `Service`, `Product` (Shop), `Article` (Blog), `FAQPage`, `BreadcrumbList`, `WebSite`.

**3.3 Homepage**
- H1 auf die Hauptintention schärfen, direkt darunter ein zitierfähiger Entity-Absatz (Wer / Was / Wo / Für wen).
- Bestehende Bento-/Prozess-Sektionen behalten; ergänzen: Verfahren, Materialien, B2B, Ablauf, Lieferzeit, FAQ-Anriss mit Links in die Cluster.

**3.4 Leistungsseiten (5 neue Seiten)**
Gemeinsame Vorlage: Kurzantwort (2–4 Sätze) → Vorteile/Grenzen → Materialien → Anwendungen → Toleranzen/Oberflächen → Lieferzeit → FAQ → CTA Kalkulator.

**3.5 Materialseiten**
`/materialien` wird Hub; pro real angebotenem Material eine Detailseite mit Kurzantwort „Wann dieses Material?“, Eigenschaften, Grenzen, Anwendungen, Alternativen-Vergleich, FAQ, CTA. Materialliste kommt aus der Filament-Bibliothek, damit nichts erfunden wird.

**3.6 Vergleichs- und Kostenseiten**
Jeweils mit „Kurz gesagt“-Antwortblock, Vergleichstabelle und Entscheidungsempfehlung. Kostenseite erklärt die echten Kostentreiber und verlinkt direkt in den Kalkulator (Preise nur so nennen, wie sie der Kalkulator tatsächlich rechnet).

**3.7 Local SEO**
Standort-Landingpages nur für tatsächlich bediente Regionen, jeweils mit echtem regionalen Bezug (Lieferung, Abholung Eschlikon, typische Kundschaft) – keine Textklone.

**3.8 Internes Linking & Conversion**
Hub-Spoke-Verlinkung, Breadcrumbs, kontextbezogene CTAs in den Kalkulator; Header/Footer-Navigation um die neuen Cluster erweitern.

## Phase 4 – Qualitätssicherung
- Build + TypeScript-Check, alle neuen Routen im Preview öffnen.
- Titles/Descriptions auf Einzigartigkeit prüfen, genau eine H1 pro Seite, Canonicals korrekt.
- Broken-Link-Check, Sitemap-Validierung, Schema-Validierung, Mobile-Ansicht, Ladezeit (Lazy Loading, Bildgrössen).

## Phase 5 – Final Report
Übersicht: geänderte Dateien, neue URLs, gelöste SEO-/AI-Search-/Local-Probleme und eine klare Liste der Punkte, für die ich echte Angaben von dir brauche (Zertifizierungen, Lieferzeiten, Referenzkunden, Maschinen, Dateiformate).

---

## Technischer Hinweis
Die Seite ist eine React-SPA: Inhalte und Meta-Tags werden erst im Browser gerendert. Google verarbeitet das inzwischen gut, viele AI-Crawler jedoch nur eingeschränkt. Mit serverseitigem Rendering wäre die Zitierfähigkeit deutlich robuster – dafür kann die App auf Lovables neueste Vorlage umgestellt werden ("/" im Chat → "Migrate to TanStack Start" oder einfach mich fragen); [was das Upgrade bringt](https://lovable.dev/blog/building-apps-using-tanstack-start). Der Plan funktioniert auch ohne dieses Upgrade.

## Offene Entscheidungen
1. Sitemap: statische Datei durch automatischen Generator ersetzen? (empfohlen)
2. Umfang jetzt: alle Phasen durchziehen oder erst Phase 1–3.3 (Technik, Entity, Homepage)?
3. Standortseiten: welche Regionen bedienst du wirklich (Versand schweizweit? Abholung nur Eschlikon?)
