
## Plan: Aufträge löschen + STL-Upload bei neuen Teilen

### Was geändert wird

**1. Auftrag löschen (AuftraegePage + AuftragDetailPage)**

- `AuftraegePage.tsx`: Jede Tabellenzeile bekommt einen Löschen-Button (Trash-Icon) mit AlertDialog-Bestätigung. Beim Löschen: `parts` löschen → `part_files` löschen → `order_status_log` löschen → `orders` löschen.
- `AuftragDetailPage.tsx`: Ebenfalls ein "Auftrag löschen"-Button in der Titelzeile (nur für bestehende Aufträge), mit AlertDialog-Bestätigung. Danach Navigation zurück zu `/auftraege`.

**2. STL-Upload bei neuen Teilen (AuftragDetailPage)**

Aktuell zeigt der Paperclip-Button nur bei gespeicherten Teilen (`part.id`). Neue, noch nicht gespeicherte Teile haben keine ID.

**Lösung**: Beim Klick auf "Teil hinzufügen" → Teil sofort in die DB einfügen (wenn Auftrag bereits existiert, also `id !== "neu"`), damit sofort eine `part.id` vorhanden ist. Der File-Upload-Button ist dann direkt verfügbar.

- Für **neue Aufträge** (`isNew = true`): Erst nach dem ersten Speichern → bereits implementiertes Verhalten beibehalten (zuerst speichern, dann Dateien hochladen).
- Für **bestehende Aufträge**: `addPart()` fügt das Teil direkt in die DB ein und bekommt sofort eine ID, sodass der Paperclip-Button sofort sichtbar ist.

### Dateien die geändert werden

1. **`src/pages/AuftraegePage.tsx`** – Löschen-Button pro Zeile + AlertDialog
2. **`src/pages/AuftragDetailPage.tsx`** – 
   - Löschen-Button in der Titelzeile (AlertDialog)
   - `addPart()` für bestehende Aufträge: direkt in DB einfügen → ID erhalten → expandieren
