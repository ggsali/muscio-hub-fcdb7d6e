# Anpassung der 48h-Aussagen (15.10.2026)

Ziel: 48 h bleibt Marketingargument, wird aber nie als Garantie oder allgemeine Lieferzusage formuliert. Produktion und Lieferung sind getrennt.

## Standardformulierungen
- Headline (Startseite, Hero-Badge): «3D-Druck in nur 48 Stunden*»
- Untertitel: «Schnelle Fertigung, hohe Qualität und zuverlässiger Versand in der ganzen Schweiz.»
- Hinweis: «*Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich. Die tatsächliche Produktions- und Lieferzeit hängt von Material, Auftragsumfang und Auslastung ab.»
- Versand getrennt: «Danach Versand mit Post oder DHL, in der Regel 1–2 Werktage innerhalb der Schweiz.»
- Meta-Texte (ohne Sternchen): «Fertigung bei geeigneten Aufträgen in 48 h möglich».

## Geänderte Dateien
Seiten/Komponenten: HomePage, StlDruckenPage, FaqPage, KostenPage, ContactPage, Kontakt, UeberUnsPage, UeberKiPage, LokalPage (Regionsseiten: Title, Description, Intro, FAQ), DruckSchweizPage, CalculatorOnlinePage (nur Texte), Footer, Marquee, ReviewsStrip, WebsiteEinstellungenPage (Standardtexte Karussell).
Meta/Strukturierte Daten: routes/_site/index.tsx, routes/_site/stl-drucken-lassen.tsx, LokalPage-Meta, company.ts (productionTime, Entity-Beschreibung), data/seo/{services,locations,regionen,comparisons}.ts (Texte, FAQ-Schema, Meta).
KI/Crawler: data/llms.txt, data/llms-full.txt.
Chat/Newsletter: supabase/functions/website-chat, generate-newsletter (Prompts; Redeploy nötig).

## Unverändert
Preise, Bestellabläufe, Funktionen, Design (nur ein kleiner Hinweistext unter dem Hero-Absatz ergänzt). AGB («Versandfertig in 1–7 Werktagen») und Versand-Mails («Lieferung in 1–2 Werktagen») sind bereits nicht garantiert und blieben stehen.

## Manuell prüfen
- Admin → Website-Einstellungen → Karussell: ein dort gespeicherter Eintrag «48h Lieferung» überschreibt den neuen Standardtext.
- Seiten mit eigenem Text in der Datenbank (CMS-Seiten, Projekte «Lieferzeit») prüfen.
