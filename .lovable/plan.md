
# Migration "3D Print Studio Features" → 3DMuscio

## Grundprinzipien

1. **Projekt-Manager (`/admin`) bleibt unangetastet** — keine Änderung an Sidebar, Seiten, Logik.
2. **Website-Verwaltung kommt in eigenen Bereich `/website-admin`** mit eigener Sidebar, eigenem Login-Gate (admin-Rolle).
3. **Schnittstellen zum Projekt-Manager**: 
   - Website-Anfragen landen wie bisher in `inquiries` → sichtbar in `/admin/anfragen`.
   - Website-Kundenregistrierungen landen via `sync_profile_to_customer` Trigger in `customers` → sichtbar in `/admin/kunden`.
   - Shop-Bestellungen erzeugen zusätzlich einen `orders`-Eintrag (Quelle `website-shop`) → im Projekt-Manager wie ein normaler Auftrag.
4. **Farbkonzept**: Das Print-Studio-Theme (helles Weiß + Grün `153 100% 40%` + Orange-Akzent `18 100% 59%`) gilt nur unter `.site-theme` (Public-Site) und `.site-theme` für `/website-admin`. Das `/admin`-Dashboard behält dunkel + orange.
5. **Reviews**: Bestehende Bewertungen aus 3D-Print-Studio-DB werden via einmaligem Sync-Skript (Edge Function `sync-studio-reviews`) ins neue `reviews`-Table kopiert.

## Phase A — DB-Schema & Daten (1 Migration)

Neue Tabellen:
- **`reviews`** (id, customer_name, customer_email, rating 1-5, kommentar, freigegeben bool, sichtbar_auf_website bool, order_id nullable, token unique, created_at)
- **`projekte`** (id, slug unique, name, kurzbeschreibung, beschreibung, kategorie, hero_image_path, gallery_paths text[], featured bool, sort_order, aktiv, created_at)
- **`partners`** (id, name, logo_path, website_url, sort_order, aktiv)
- Erweitern `shop_orders`: Spalte `order_id uuid` (Referenz auf `orders` im Projekt-Manager).

RLS:
- `reviews`: public read (nur freigegebene), admin manage. Public insert via token.
- `projekte` + `partners`: public read aktiv, admin manage.

## Phase B — Public Website komplettieren (Print-Studio 1:1)

Neue/ersetzte Seiten unter `SiteLayout`:
- `ShopPage` (`/shop`) + `ShopDetailPage` (`/shop/:slug`) — Produkte aus `shop_products`, Cart-Drawer.
- `ProjektDetailPage` (`/projekte/:slug`) + Projekte-Übersicht im Index.
- `BewertungPage` (`/bewertung/:token`) — Kunde gibt Bewertung ab.
- Reviews-Sektion auf Homepage.
- `ChatWidget` (floating, public) — schreibt in bestehende `chat_sessions`/`chat_messages`.
- `CartContext` + `CartDrawer` + `ShopPromoBanner`.
- Übernehmen: `AnimatedCounter`, `FloatingOrbs`, `GlowCard`, `ModelViewer3D`, `PartnerMarquee`-Daten.

Edge Functions:
- `create-shop-checkout` — Stripe Checkout für Warenkorb (mode: payment).
- `shop-webhook` — bei Erfolg: `shop_orders.status='paid'`, erzeugt `orders`-Eintrag im Projekt-Manager.
- `submit-review` — public, schreibt Bewertung mit Token.
- `sync-studio-reviews` — einmalig, holt Reviews aus 3D-Print-Studio-DB via STUDIO_SERVICE_ROLE_KEY und kopiert sie.

## Phase C — Website-Admin (`/website-admin`)

Eigene Sidebar mit:
- Dashboard (Übersicht: offene Anfragen, neue Bestellungen, Reviews zum Freigeben)
- Shop → Produkte, Kategorien, Bestellungen
- Projekte (CRUD)
- Bewertungen (freigeben/ablehnen)
- Partner-Logos
- Chat-Postfach (Public Chat)
- E-Mail-Templates
- Website-Einstellungen (Wartungsmodus, Kontakt, FAQ, Materialpreise)

Komponenten:
- `WebsiteAdminLayout.tsx` (eigene Sidebar, eigener Header, separater Theme-Scope)
- `WebsiteAdminGate.tsx` (prüft auth + admin-Rolle, sonst Redirect zu `/login?next=/website-admin`)

Bestehende Seiten verschieben:
- `WebsiteBestellungenPage` → `/website-admin/bestellungen`
- `WebsiteKundenAdminPage` → entfällt (Kunden sind im Projekt-Manager)
- `EmailTemplatesPage` → `/website-admin/email-templates`
- `WebsiteEinstellungenPage` → `/website-admin/einstellungen`
- `ChatPage` (Public Chat-Postfach) → `/website-admin/chat` (im /admin gibt's keinen Public-Chat-Eintrag mehr)

Aus `/admin`-Sidebar entfernen: Website-Bestellungen, Website-Kunden, E-Mail-Templates, Website-Einstellungen, Public-Chat. (Projekt-Manager-Funktionen wie Aufträge, Kunden, Filamente, Kalkulator, Teile, Kalender, interne Einstellungen, Anfragen bleiben.)

## Technische Hinweise

- `/login` erkennt `?next=…` und redirected nach Login dorthin.
- Cross-Tenant Reviews-Sync nutzt bestehende Secrets `STUDIO_SUPABASE_URL`, `STUDIO_SERVICE_ROLE_KEY`.
- Stripe-Webhook reuses bestehender `STRIPE_WEBHOOK_SECRET` (neuer Endpoint `shop-webhook` separat eintragen).
- Theme: gleiche `.site-theme`-Klasse auf `WebsiteAdminLayout` anwenden → identisches helles Grün-Design.
- `cloud_status` vor Migration prüfen.

## Reihenfolge der Umsetzung

1. **Phase A** (Migration genehmigen) → ich warte auf dein OK pro Migration.
2. **Phase B** Schritt 1: Cart/Shop-Seiten + Stripe-Checkout.
3. **Phase B** Schritt 2: Reviews + ProjektDetail + ChatWidget + Reviews-Sync.
4. **Phase C**: Website-Admin Sidebar/Routing + Seiten verschieben + /admin entrümpeln.

Nach jeder Phase: kurze Visual-Kontrolle im Preview, dann nächste Phase.

## Was NICHT geändert wird

- Keine Änderung an Tabellen `parts`, `orders`, `customers` (außer neue Spalte für shop-Verknüpfung), `bills`, `time_entries`, `filaments`, `price_presets`, `email_templates` (Inhalt).
- Keine Änderung an `/admin`-Seiten-Logik (Dashboard, Aufträge, Teile, Kalkulator, Filamente, Kalender, Einstellungen, Anfragen, Kunden).
- Dashboard-Theme bleibt dunkel + orange.
