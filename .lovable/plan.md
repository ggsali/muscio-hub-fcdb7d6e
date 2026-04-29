## Ziel
Bestehendes 3DMuscio Dashboard so erweitern, dass Website-Bestellungen, -Kunden und -Rechnungen nahtlos integriert sind, plus eine neue Sidebar-Section **Website** für Website-spezifische Verwaltung. Keine Duplikate, keine Designänderungen, kein Eingriff in bestehende Daten.

## 1. Datenbank-Migration

**`orders` erweitern:**
- `source` TEXT DEFAULT `'manual'` (Werte: `'manual'` | `'website'`)
- `notes_internal` TEXT (nie an Kunden sichtbar)
- Index auf `source` für Filter-Performance

**`customers` erweitern:**
- `auth_user_id` UUID NULL (Verknüpfung zu `auth.users.id` per E-Mail-Match)
- Unique-Index auf `lower(email)` (verhindert Duplikate bei künftigen Upserts)

**Neue Tabelle `email_templates`:**
- `status_key` TEXT PRIMARY KEY (`datei_erhalten`, `im_druck`, `qualitaetspruefung`, `versandt`, `geliefert`)
- `betreff` TEXT, `nachricht` TEXT, `aktiv` BOOLEAN DEFAULT true
- Seed mit 5 Default-Templates auf Deutsch im 3DMuscio-Stil
- RLS: nur authenticated

**Neue Tabelle `website_settings`:**
- `key` TEXT PRIMARY KEY, `value` JSONB
- Seed-Keys: `wartungsmodus`, `kontakt_info`, `faq`, `material_preise`
- RLS: SELECT für `anon` (Website liest), ALL für `authenticated` (Dashboard schreibt)

**RLS bestehender Tabellen:**
- Bleibt wie ist (authenticated = volle Rechte). Customer-Self-Service-RLS gehört ins Website-Projekt, nicht hier.

## 2. Sidebar — neue Section "Website"

In `AppLayout.tsx` neuer Abschnitt mit 4 Routen:
- `/website/bestellungen` → gefilterte AuftraegePage (`source = 'website'`)
- `/website/kunden` → Kundenliste mit Auth-Verknüpfung, Last-Login, Passwort-Reset-Button
- `/website/email-templates` → Editor für die 5 Status-Texte (Betreff + Nachricht)
- `/website/einstellungen` → Wartungsmodus-Toggle, Kontakt, FAQ-Editor, Materialpreise

## 3. Bestehende Views erweitern

**`AuftraegePage`:** neue Spalte/Badge "Quelle" (Website/Manuell), Filter-Dropdown.
**`AuftragDetailPage`:** Source-Badge im Header, neues Feld "Interne Notizen".
**`KundenPage` & `KundeDetailPage`:** kleines Badge "Hat Konto" wenn `auth_user_id` gesetzt.
**`BillsSection`:** unverändert — Rechnungen aus Website-Aufträgen erscheinen automatisch via `order_id`.

## 4. Auto-E-Mail bei Statuswechsel

**Neue Edge Function `send-status-email`:**
- Input: `order_id`, `status_key`
- Lädt Template aus `email_templates`, Kunde aus `customers`
- Variablen-Ersetzung: `{{vorname}}`, `{{auftragsnummer}}`, `{{status}}`
- Versand via Resend von `info@3dmuscio.com` (RESEND_API_KEY existiert bereits)
- Skip wenn Kunde keine E-Mail hat oder Template inaktiv

**Trigger im Dashboard:**
- In `OrderStatusWorkflow` und überall wo Status geändert wird: nach erfolgreichem Update Edge Function aufrufen
- AlertDialog-Bestätigung vor Versand (gemäß bestehender Memory-Regel "Email Security")

## 5. Auth-Verknüpfung Kunden

Edge Function `link-website-customers` (manuell via Button in Website→Kunden):
- Liest alle `auth.users` via Service-Role
- Matched per E-Mail (case-insensitive) auf `customers`
- Setzt `auth_user_id`, erstellt fehlende Kunden
- Idempotent

## Was NICHT geändert wird
- Keine bestehenden Tabellenfelder, keine Daten-Migration
- Keine visuellen Designänderungen
- Stripe, Time Tracking, PDF-Generation, QR-Bill: unangetastet
- Website-Projekt: separat, hier nur die geteilte DB vorbereitet

## Technisch
- Migration in einem Schritt (Schema + Seeds für `email_templates` und `website_settings`)
- `useSettings`/Context-Pattern wiederverwenden
- Edge Functions in `supabase/functions/send-status-email/` und `link-website-customers/`
- Routen in `App.tsx` ergänzen, Sidebar-Items in `AppLayout.tsx`
