# Implementierungsplan: 5 neue Features für 3DMuscio

Das ist ein sehr umfangreicher Auftrag mit 5 unabhängigen Features. Ich schlage vor, sie in der unten stehenden Reihenfolge umzusetzen — kleinere/risikoärmere zuerst, große am Schluss.

## 1. Automatische Bewertungsanfrage (klein)

**DB:** Migration — `orders.bewertungs_token uuid` hinzufügen.

**Code:**
- `OrderStatusWorkflow.tsx`: Bei Statuswechsel auf `Abgeschlossen` Token generieren, in `orders` speichern, dann `send-transactional-email` mit Template `bewertung` aufrufen.
- `transactional-email-templates/bewertung.tsx` neu anlegen (3DMuscio-Branding, 2 Buttons: interner Bewertungslink + Google-Review).
- In `registry.ts` registrieren.
- Edge Function `send-transactional-email` re-deployen.

## 2. Visueller Fortschrittsbalken im Kundenportal (klein)

**Code:**
- Neue Komponente `src/components/portal/OrderProgress.tsx` mit 5 Schritten (Bestellt → In Produktion → QK → Versandbereit → Abgeschlossen), Status-Mapping, Framer-Motion, responsive (horizontal Desktop / vertikal Mobile).
- In `PortalOrdersPage.tsx` pro Auftrag einbinden.

## 3. 3D-Viewer für Referenzprojekte (mittel)

**DB:** Migration — `projekte.stl_url text`, neuer öffentlicher Storage-Bucket `project-stls` mit Admin-Write/Public-Read RLS.

**Code:**
- `bun add three@0.160.0 @types/three`
- Neue Komponente `src/components/site/StlViewer.tsx` (STLLoader + OrbitControls, Auto-Rotate, dunkler Hintergrund, weiches Licht).
- `ProjektDetailPage.tsx`: wenn `stl_url` vorhanden → Viewer statt Hauptbild, sonst Fallback.
- `ProjekteAdminPage.tsx`: STL-Upload-Feld (Bucket `project-stls`).

## 4. Blog/News-Seite (groß)

**DB:** Migration — `blog_posts` Tabelle mit RLS (öffentlich lesen wenn veröffentlicht; Admin schreiben).

**Code:**
- `bun add react-markdown`
- `src/pages/site/BlogPage.tsx` — Karten-Übersicht, Route `/blog`.
- `src/pages/site/BlogPostPage.tsx` — Einzelpost, Markdown, Route `/blog/:slug`.
- `src/pages/website-admin/BlogAdminPage.tsx` — CRUD mit Markdown-Editor + Live-Vorschau.
- Routen in `App.tsx` ergänzen, Admin-Eintrag im `WebsiteAdminLayout`.
- Header (`SiteHeader` / `site/Header`): „Blog" zwischen „Über uns" und „FAQ".
- Footer: Link zu `/blog`.
- 3 Seed-Posts via `insert`-Tool nach Migration.

## 5. Affiliate/Empfehlungsprogramm (groß)

**DB:** Migration — `referrals` Tabelle (referrer_customer_id, referred_email, referred_customer_id, status, rabatt_code unique, rabatt_prozent, created_at) mit RLS (Kunde sieht eigene Referrals, Admin alles).

**Code:**
- `PortalProfilePage.tsx`: Abschnitt „Freunde empfehlen" — persönlicher Link mit Code, Copy-Button, Tabelle eigener Empfehlungen, Erklärtext.
- `kunde/Register.tsx`: `?ref=CODE` aus URL nach erfolgreicher Registrierung in `referrals` einfügen (referred_customer_id setzen).
- `EinstellungenPage.tsx`: Abschnitt „Empfehlungsprogramm" mit Aktiv-Toggle und Rabatt-Prozentsatz (in `settings`-Tabelle).

---

## Hinweise / Risiken

- **Umfang:** Das sind viele Files (~15+ neue, ~10 geänderte) und 4 separate Migrationen. Es ist möglich dass nicht alle Features in einem Durchlauf 100% bug-frei rauskommen — ich teste Build/Typen, aber kleinere Nachbesserungen können nötig sein.
- **3D-Viewer Performance:** Three.js ist ~600KB. Ich lade die Komponente lazy.
- **Bewertungs-Token-Seite:** `/bewertung/:token` existiert vermutlich noch nicht für Token-Lookup — ich prüfe `BewertungPage` und passe ggf. an, damit der Link aus der Mail funktioniert.
- **Empfehlungs-Rabatt anwenden:** Ich speichere die Empfehlungen nur — die tatsächliche Rabatt-Verrechnung beim nächsten Auftrag würde eine separate Logik im Bestellprozess brauchen (kann ich später nachziehen, wenn gewünscht).

Soll ich so loslegen?
