# Auftrag fuer den Server-Claude (muscio): Gravur-Dienst

Ziel: Im bestehenden Slicer-Dienst (FastAPI, 127.0.0.1:8088, X-API-Key wie bei /files/*) kommen neue Endpunkte `/gravur/*` dazu.
Sie schneiden Text aus Bildern 1:1 in ein 3D-Modell (Gravur ohne Offset). Alles rechnet der Server, der Browser zeigt nur die Vorschau.
Aufrufer ist die Supabase Edge Function `gravur-server` (Code im Repo `ggsali/muscio-hub-fcdb7d6e`, Branch main, Datei `supabase/functions/gravur-server/index.ts`). Der Slicer-Betrieb darf davon nicht beeintraechtigt werden (eigener Worker-Pool, niedrige Prioritaet `nice`, nie Drucker oder Queue anfassen).

## Abhaengigkeiten (in der Slicer-venv, nichts systemweit veraendern)
- `manifold3d` (Boolean-Operationen), `trimesh` (STL/OBJ lesen, Reparatur), `numpy`, `Pillow`
- Potrace: `potracer` (pure Python) oder `apt install potrace` + CLI. Es zaehlt die Qualitaet der Kurven.
- optional `opencv-python-headless` fuer Hochskalieren (Lanczos) und Entrauschen

## Endpunkte
### POST /gravur/jobs   (Header X-API-Key)
JSON-Body:
```json
{
  "job_id": "uuid",
  "model_url": "https://...signed GET (STL oder OBJ, Einheit mm)",
  "images": [{"name": "winner-1", "url": "https://...signed GET"}],
  "frame": [16 Zahlen, spaltenweise (Three.js Matrix4.elements): lokal -> Welt; lokal z = Flaechennormale nach aussen, lokal xy = Flaechenebene, Ursprung = Mitte der Flaeche auf der Flaeche],
  "place": {"widthMm": 64, "dx": 12, "dy": -8, "rotDeg": 0, "depth": 0.6, "centerInk": false},
  "image": {"threshold": null, "invert": null},
  "colors": {"modell": "#9AA3AD", "einlage": "#14B8A6"},
  "model_name": "puck",
  "result_put_url": "https://...signed PUT-Upload-URL (Supabase Storage), Ziel: ergebnis.zip"
}
```
Antwort sofort: `{"id": "<slicer job id>"}`. Rechnen im Hintergrund (Warteschlange, max. 2 parallele Jobs, pro Bild eigener Task).

### GET /gravur/jobs/{id}
`{"status": "queued|running|done|error", "done": 3, "total": 20, "errors": ["name: Grund"], "error": "nur bei status=error"}`
`done` erst setzen, wenn das ZIP vollstaendig hochgeladen ist (status=done heisst: ergebnis.zip liegt im Storage).

## Rechenweg pro Bild (muss zu src/lib/gravur.ts im Repo passen, dort ist die Referenz-Implementierung mit Tests)
1. Bild laden (Originalgroesse, Alpha beachten). Hochskalieren auf lange Seite ca. 2400 px, falls kleiner.
2. Maske (Vordergrund = Text):
   - Transparentes PNG (>2 % Pixel mit Alpha < 250): Maske = Alpha (invert=true kehrt um).
   - Sonst Graustufen (halbtransparent auf Weiss legen), Otsu-Schwelle (Plateau-Mitte, bei reinem Schwarz/Weiss ca. 128), Text = die kleinere Flaeche; `invert` = true kehrt um, false/null = automatisch. `threshold` falls gesetzt statt Otsu.
   - Leichter Gauss (sigma ca. 1 px bei 1600 px Breite) gegen Pixelstufen.
3. Vektorisieren mit Potrace (turdsize ca. 4, alphamax ca. 1.0, opttolerance ca. 0.2). Kurven in Polylinien umwandeln (Abtastung so, dass Abweichung < 0.02 mm im fertigen Mass). Aussen- und Lochkonturen richtig (Even-Odd) zu Flaechen mit Loechern. Bild-Y zeigt nach unten: vor dem Weiterrechnen y' = Bildhoehe - y.
4. Platzierung (Bildpixel, Y oben -> Welt): `M = frame * T(dx,dy,0) * Rz(rotDeg) * S(s) * T(-cx,-cy,0)` mit `s = widthMm / Bildbreite_px`; Anker (cx,cy) = Bildmitte, bei `centerInk=true` Mitte der Text-Bounding-Box.
5. Textkoerper: Flaeche mit Loechern extrudieren von z = -depth bis z = +1.5 mm (lokal, in mm nach Skalierung), dann mit M ins Weltsystem.
6. Modell: STL/OBJ lesen, vereinigen/reparieren (trimesh.repair, fill_holes, Normalen), in Manifold wandeln. Ist es nicht manifold, reparieren; klappt das nicht, Fehler fuer dieses Bild melden.
7. `modell_mit_gravur = Modell - Textkoerper`, `einlage = Modell ∩ Textkoerper` (exakt, kein Offset, keine Toleranz).
   Ist das Volumen der Einlage < 50 % von (Textflaeche * depth), Rueckfall: Einlage = Textkoerper von z=-depth bis z=0 (nur bis zur Flaeche) und in der Fehlerliste `name: Einlage als voller Textkoerper (Modell nicht geschlossen)` vermerken.
8. Ausgabe nur in den Koordinaten des Originalmodells (nichts verschieben).

## Ergebnis-ZIP (per HTTP PUT an result_put_url, Header Content-Type: application/zip und x-upsert: true; Body = ZIP-Bytes; falls Supabase das so nicht annimmt, mit curl testen und die Variante nehmen, die geht, z. B. multipart/form-data mit Feld `file`; danach dem Repo-Betreuer die Variante mitteilen)
Pro Bild ein Ordner `NNN-<name>/` (NNN = laufende Nummer ab 001) mit:
- `NNN-<name>-modell.stl`, `NNN-<name>-einlage.stl` (binaeres STL)
- `NNN-<name>.3mf` mit einer Baugruppe (zwei Objekte "Modell mit Gravur" und "Text-Einlage" als Components eines Elternobjekts, Einheit mm, `basematerials` mit den Farben aus `colors`, beide Teile an Ort und Stelle)
Dazu bei Fehlern `FEHLER.txt` (eine Zeile pro Problem). Das Browser-Frontend liest fuer den Einzelmodus `001-*-modell.stl` und `001-*-einlage.stl` aus dem ZIP.

## Abnahme
- Test: Zylinder r=40, h=10 (Deckel z=5), Ring-Bild (aussen r 30 px, innen 15 px auf 100x100 px, widthMm 50, depth 1): Einlagevolumen = pi*(900-225)*0.25 = 530 mm3 (+-3 %), Modellvolumen + Einlage = Original, Einlage-Oberkante z=5, Unterkante z=4.
- 20 Bilder auf ein Modell mit 500k Dreiecken in unter 2 Minuten.
- Kein Geheimnis in Logs oder Antworten. Nichts am bestehenden Slicer/Drucker-Betrieb aendern.
