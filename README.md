# 3dMuscio Dashboard

# 3dMuscio – Vollständiger Lovable-Prompt

## Interne Business-App: Kalkulationsmaschine & Kundendatenbank

-----

## 🎯 PROJEKT-ÜBERBLICK

Baue mir eine **vollständige interne Web-App** für mein Schweizer 3D-Druck-Business “3dMuscio”.

Die App ist **nur für mich** (single-user, kein öffentlicher Zugang).

Design: **Professionell, dunkel (Dark Mode), Orange-Akzente (#FF5A00)**, wie ein modernes SaaS-Dashboard.

Sprache der App: **Deutsch**.

Tech-Stack: React + Tailwind + Supabase (für Datenbank & Auth).

-----

## 🔐 1. AUTHENTIFIZIERUNG

- Einfaches Login mit E-Mail + Passwort (nur 1 Account: mein eigener)

- Nach Login: direkter Redirect zum Dashboard

- Kein öffentlicher Register-Button (oder mit Einladungs-Code geschützt)

- Session bleibt gespeichert (kein erneutes Login bei jedem Besuch)

-----

## 🗂️ 2. NAVIGATION (Sidebar)

Linke Sidebar mit folgenden Bereichen:

```

📊  Dashboard

👥  Kunden

📦  Aufträge

🔩  Teile-Bibliothek

🧮  Kalkulator

⚙️  Einstellungen

```

-----

## 📊 3. DASHBOARD (Startseite)

Übersicht mit folgenden KPI-Kacheln oben:

|Kachel            |Wert                                |Farbe |

|------------------|------------------------------------|------|

|Gesamtumsatz (CHF)|Summe aller abgeschlossenen Aufträge|Blau  |

|Reingewinn (CHF)  |Umsatz minus Kosten                 |Grün  |

|Investitions-Fonds|20% des Gewinns                     |Orange|

|Ø Marge (%)       |Durchschnitt aller Aufträge         |Lila  |

|Offene Aufträge   |Anzahl mit Status “In Bearbeitung”  |Gelb  |

|Skalierungsziel   |Fortschrittsbalken CHF 0 → 1’500    |Grün  |

Darunter:

- **Tabelle der letzten 5 Aufträge** (Kunde, Betrag, Status, Datum)

- **Schnellzugriff-Button**: „+ Neuer Auftrag” (gross, orange)

-----

## 👥 4. KUNDENDATENBANK

### Kundenliste

- Tabelle mit allen Kunden: Name, Firma, E-Mail, Telefon, Anzahl Aufträge, Gesamtumsatz

- Suchfeld (Suche nach Name oder Firma)

- Filter: Alle / Aktiv / Inaktiv

- Button: „+ Neuer Kunde”

### Kundendetail-Seite

Wenn ich auf einen Kunden klicke, öffnet sich eine Detailseite mit:

**Tab 1: Kontakt**

- Name, Firma, E-Mail, Telefon, Adresse, Notizen

- Bearbeiten-Button

**Tab 2: Auftragshistorie**

- Alle Aufträge dieses Kunden (Tabelle)

- Spalten: Auftrags-Nr., Datum, Beschreibung, Umsatz CHF, Status

- Gesamt-KPIs für diesen Kunden: Umsatz total, Gewinn total, Ø Marge

**Tab 3: Teile**

- Alle Teile die ich je für diesen Kunden gedruckt habe

- Spalten: Teilname, Material, Gewicht (g), Druckzeit (h), Preis (CHF), Datum

- Wiederbestellen-Button pro Teil (erstellt sofort neuen Auftrag mit denselben Werten)

### Kundendaten-Felder (Datenbank)

```

id, name, firma, email, telefon, adresse, notizen, erstellt_am, aktiv (bool)

```

-----

## 📦 5. AUFTRÄGE

### Auftragsliste

- Tabelle aller Aufträge

- Spalten: Nr., Datum, Kunde, Beschreibung, Umsatz (CHF), Kosten (CHF), Gewinn (CHF), Marge (%), Status

- Filter: Alle / Offen / In Bearbeitung / Abgeschlossen / Storniert

- Sortierung nach Datum / Betrag / Kunde

- Suchfeld

### Neuer Auftrag erstellen

Formular mit:

1. **Kunde auswählen** (Dropdown aus Kundendatenbank, oder „+ Neuer Kunde” direkt anlegen)

1. **Beschreibung** (Freitext)

1. **Datum** (automatisch heute, änderbar)

1. **Status**: Offen / In Bearbeitung / Abgeschlossen / Storniert

Dann: **Teile-Liste** (das Herzstück!)

- Tabelle wo ich Zeile für Zeile jedes Teil eintrage:

|Spalte                 |Typ                                                 |

|-----------------------|----------------------------------------------------|

|Teilname / Beschreibung|Text                                                |

|Material               |Dropdown: PLA / PETG / TPU / Sonstige               |

|Menge                  |Zahl (default: 1)                                   |

|Gewicht pro Stück (g)  |Zahl                                                |

|Druckzeit pro Stück (h)|Zahl                                                |

|Nachbearbeitung (h)    |Zahl                                                |

|Konstruktion (h)       |Zahl                                                |

|Preis pro Stück (CHF)  |**Auto-berechnet** (Formel, nicht editierbar)       |

|Preis total (CHF)      |**Auto-berechnet** (Preis × Menge)                  |

|Status                 |Dropdown: Ausstehend / In Druck / Fertig / Geliefert|

|Notizen                |Text                                                |

- „+ Teil hinzufügen” Button

- Zeile löschen Button (Mülleimer-Icon)

**Auftrags-Zusammenfassung** (rechts oder unten, live aktualisiert):

```

Setup-Pauschale:          CHF 20.00

Material-Kosten:          CHF xx.xx

Maschinenzeit:            CHF xx.xx

Nachbearbeitung:          CHF xx.xx

Konstruktion:             CHF xx.xx

─────────────────────────────────────

TOTAL UMSATZ:             CHF xx.xx

Meine Kosten (intern):    CHF xx.xx

REINGEWINN:               CHF xx.xx

MARGE:                    xx.x %

```

### Auftrag-Detailseite

- Alle oben genannten Infos

- Status ändern (mit Klick, kein Formular)

- PDF-Export Button: „Rechnung/Übersicht exportieren”

- Bearbeiten / Löschen Button

-----

## 🔩 6. TEILE-BIBLIOTHEK

Alle Teile die ich je gedruckt habe – als Bibliothek / Archiv:

- Tabelle: Teilname, Kunde, Material, Gewicht, Druckzeit, Preis, Datum, Auftrag-Nr.

- Suchfeld und Filter nach Material / Kunde

- **Wiederbestellen**: Klick erstellt neuen Auftrag mit vorausgefüllten Werten

- Statistiken: Meistgedrucktes Teil, Ø Preis pro Material

-----

## 🧮 7. KALKULATOR (Standalone-Tool)

Ein Taschenrechner-ähnliches Tool zum schnellen Kalkulieren ohne Auftrag zu erstellen:

**Eingabefelder:**

- Gewicht (g): ___

- Druckzeit (h): ___

- Nachbearbeitung (h): ___

- Konstruktion (h): ___

- Menge: ___

**Live-Ergebnis (sofort beim Tippen):**

```

Setup:              CHF 20.00

Material:           CHF xx.xx

Maschinenzeit:      CHF xx.xx

Nachbearbeitung:    CHF xx.xx

Konstruktion:       CHF xx.xx

─────────────────────────

PREIS PRO STÜCK:    CHF xx.xx

PREIS TOTAL:        CHF xx.xx

Meine Kosten:       CHF xx.xx

Gewinn:             CHF xx.xx

Marge:              xx.x %

```

- Button: „Als Auftrag speichern” → öffnet Auftrags-Formular mit vorausgefüllten Werten

- Button: „Zurücksetzen”

-----

## ⚙️ 8. EINSTELLUNGEN

Hier kann ich die Verrechnungssätze anpassen (werden überall in der App verwendet):

|Einstellung             |Standardwert  |

|------------------------|--------------|

|Setup-Pauschale         |CHF 20.00     |

|Material-Preis (Verkauf)|CHF 0.055 / g |

|Maschinenzeit           |CHF 3.00 / h  |

|Nachbearbeitung         |CHF 50.00 / h |

|Konstruktion            |CHF 65.00 / h |

|Material-Einkauf        |CHF 25.00 / kg|

|Strom & Verschleiß      |CHF 0.80 / h  |

|Skalierungsziel         |CHF 1’500.00  |

|Investitions-Fonds %    |20%           |

Alle Werte in einem Formular, „Speichern” Button.

→ Wenn ich hier einen Wert ändere, werden **alle Berechnungen in der ganzen App** automatisch neu berechnet.

-----

## 🧮 KALKULATIONSFORMELN

Diese Formeln müssen überall konsistent verwendet werden:

```

UMSATZ = Setup + (Gewicht × Mat_Verkauf) + (Druckzeit × Maschine) + (Nachbearbeitung × NB_Satz) + (Konstruktion × Design_Satz)

KOSTEN = (Gewicht / 1000 × Mat_Einkauf_pro_kg) + (Druckzeit × Strom_Verschleiß)

GEWINN = Umsatz - Kosten

MARGE = Gewinn / Umsatz × 100

INVEST_FONDS = Gewinn_Total × Invest_Prozent

```

-----

## 🎨 DESIGN-VORGABEN

```

Hintergrund:     #0F0F0F (fast schwarz)

Sidebar:         #1A1A1A

Karten/Cards:    #1E1E1E

Akzentfarbe:     #FF5A00 (Orange)

Sekundär:        #FFAA00 (Amber)

Text:            #FFFFFF / #AAAAAA (grau)

Erfolg/Grün:     #27AE60

Fehler/Rot:      #E74C3C

Info/Blau:       #2980B9

Schrift:         Inter oder System-UI

Border-Radius:   8px (Karten), 6px (Inputs)

```

**UI-Prinzipien:**

- Tabellen haben alternierende Zeilen (leicht heller)

- Hover-Effekte auf Tabellenzeilen (zeigt Klickbarkeit)

- Status-Badges als farbige Pills (Offen=Gelb, In Bearbeitung=Blau, Fertig=Grün, Storniert=Rot)

- Zahlen rechtsbündig in Tabellen

- CHF-Beträge immer mit 2 Dezimalstellen

-----

## 🗄️ DATENBANK-SCHEMA (Supabase)

```sql

-- Einstellungen

settings: id, key, value, updated_at

-- Kunden

customers: id, name, firma, email, telefon, adresse, notizen, created_at, aktiv

-- Aufträge

orders: id, customer_id, beschreibung, datum, status, 

        umsatz_total, kosten_total, gewinn_total, marge,

        created_at, updated_at

-- Teile (pro Auftrag)

parts: id, order_id, customer_id, 

       teilname, material, menge,

       gewicht_g, druckzeit_h, nachbearbeitung_h, konstruktion_h,

       preis_pro_stueck, preis_total,

       status, notizen, created_at

```

-----

## ✅ ZUSAMMENFASSUNG: MUSS-FEATURES

1. ✅ Login (nur für mich)

1. ✅ Dashboard mit KPIs und Skalierungsfortschritt

1. ✅ Kundendatenbank mit Detailseite & Auftragshistorie

1. ✅ Aufträge mit Teile-Liste pro Auftrag

1. ✅ Live-Kalkulation mit einstellbaren Sätzen

1. ✅ Teile-Bibliothek mit Wiederbestellen-Funktion

1. ✅ Standalone-Kalkulator

1. ✅ Einstellungen für alle Verrechnungssätze

1. ✅ Dark Mode Design mit Orange-Akzenten

1. ✅ Alle Daten persistent in Supabase gespeichert

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://muscio-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e039d41a-5e9f-42b9-86f0-c4af1f4d8b33).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
