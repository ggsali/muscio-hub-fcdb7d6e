// STL-Analyse: Geometrie, Orientierungsoptimierung, Support-Erkennung und Preisberechnung
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DENSITY: Record<string, number> = {
  PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21, NYLON: 1.14, PA: 1.14, RESIN: 1.15, ASA_CF: 1.15,
};

function densityFor(material: string): number {
  const key = String(material || "").toUpperCase();
  for (const k of Object.keys(DENSITY)) if (key.includes(k)) return DENSITY[k];
  return 1.24;
}

/** Grenzen, damit der Edge-Worker nicht am Speicher-/CPU-Limit abbricht */
const MAX_BASE64_LEN = 24 * 1024 * 1024; // ~18 MB Datei
const MAX_TRIS = 300_000;

/** Base64 blockweise dekodieren (kein zeichenweiser Aufbau über die ganze Datei) */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  const CHUNK = 65536;
  for (let start = 0; start < bin.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bin.length);
    for (let i = start; i < end; i++) out[i] = bin.charCodeAt(i);
  }
  return out;
}


function parseStl(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isBinary = bytes.byteLength >= 84 && view.getUint8(0) !== 115; // "s" von "solid"
  const tris: Tri[] = [];
  let volume = 0, surface = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const pushTriangle = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ) => {
    for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    volume += (ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by)) / 6;
    const e1 = [bx - ax, by - ay, bz - az];
    const e2 = [cx - ax, cy - ay, cz - az];
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const len = Math.sqrt(cr[0] ** 2 + cr[1] ** 2 + cr[2] ** 2);
    const area = len / 2;
    surface += area;
    if (len > 0) tris.push({ nx: cr[0] / len, ny: cr[1] / len, nz: cr[2] / len, area });
  };

  if (isBinary) {
    const count = view.getUint32(80, true);
    const safeCount = Math.min(count, Math.floor((bytes.byteLength - 84) / 50));
    for (let i = 0; i < safeCount; i++) {
      const off = 84 + i * 50 + 12; // Normale überspringen, aus Vertices berechnen
      pushTriangle(
        view.getFloat32(off, true), view.getFloat32(off + 4, true), view.getFloat32(off + 8, true),
        view.getFloat32(off + 12, true), view.getFloat32(off + 16, true), view.getFloat32(off + 20, true),
        view.getFloat32(off + 24, true), view.getFloat32(off + 28, true), view.getFloat32(off + 32, true),
      );
    }
  } else {
    const text = new TextDecoder().decode(bytes);
    const verts: number[] = [];
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    for (let i = 0; i + 8 < verts.length; i += 9) {
      pushTriangle(
        verts[i], verts[i + 1], verts[i + 2],
        verts[i + 3], verts[i + 4], verts[i + 5],
        verts[i + 6], verts[i + 7], verts[i + 8],
      );
    }
  }

  return {
    tris,
    volumeMm3: Math.abs(volume),
    surfaceMm2: surface,
    bbox: {
      x: Number.isFinite(maxX - minX) ? maxX - minX : 0,
      y: Number.isFinite(maxY - minY) ? maxY - minY : 0,
      z: Number.isFinite(maxZ - minZ) ? maxZ - minZ : 0,
    },
  };
}

/** Anteil (in %) der Fläche, die bei gegebener Bau-Richtung Support braucht */
function overhangShare(tris: Tri[], up: [number, number, number], thresholdDeg: number): number {
  const limit = -Math.cos(((90 - thresholdDeg) * Math.PI) / 180);
  let total = 0, over = 0;
  for (const t of tris) {
    const dot = t.nx * up[0] + t.ny * up[1] + t.nz * up[2];
    total += t.area;
    // Flächen, die praktisch flach auf der Druckplatte liegen (dot ≈ -1), brauchen keinen Support
    if (dot < limit && dot > -0.98) over += t.area;

  }
  return total > 0 ? (over / total) * 100 : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      stlBase64, fileName,
      material = "PLA", pricePerGram = 0.055,
      qualityKey = "standard", layerHeight = 0.2, infill = 20, speedFactor = 1.0,
      quantity = 1,
      maschinenzeit = 3, setupFee = 20, minPrice = 5,
      minuten_pro_gramm = 2.5,
      overhang_schwellwert = 30,
      komplexitaets_aufschlag = 20,
      versandkosten = 8,
      versandkostenfrei_ab = 65,
    } = body ?? {};

    if (typeof stlBase64 !== "string" || stlBase64.length < 100) {
      return json({ error: "stlBase64 fehlt oder ist ungültig" }, 400);
    }

    const geo = parseStl(base64ToBytes(stlBase64));
    if (geo.volumeMm3 <= 0 || geo.tris.length === 0) {
      return json({ error: "STL konnte nicht gelesen werden" }, 422);
    }

    const volumeCm3 = geo.volumeMm3 / 1000;

    // ── Orientierungsoptimierung (6 Hauptachsen) ──
    const axes: { label: string; up: [number, number, number] }[] = [
      { label: "Original (Z oben)", up: [0, 0, 1] },
      { label: "Umgedreht (Z unten)", up: [0, 0, -1] },
      { label: "X-Seite oben", up: [1, 0, 0] },
      { label: "X-Seite unten", up: [-1, 0, 0] },
      { label: "Y-Seite oben", up: [0, 1, 0] },
      { label: "Y-Seite unten", up: [0, -1, 0] },
    ];
    const scored = axes.map((a) => ({
      label: a.label,
      overhang: overhangShare(geo.tris, a.up, overhang_schwellwert),
    }));
    const original = scored[0];
    const best = scored.reduce((b, s) => (s.overhang < b.overhang - 1 ? s : b), original);

    const hatSupport = best.overhang > 5;

    // ── Gewicht ──
    const density = densityFor(material);
    const shellFactor = 0.4;
    const fillFactor = shellFactor + (1 - shellFactor) * (Math.max(0, Math.min(100, infill)) / 100);
    const weightG = Math.max(1, Math.round(volumeCm3 * density * fillFactor * 1.25 * 10) / 10);

    // ── Druckzeit ──
    const layerFactor = layerHeight > 0 ? 0.2 / layerHeight : 1;
    const druckzeitMinuten = Math.max(
      5,
      Math.round(weightG * minuten_pro_gramm * speedFactor * layerFactor),
    );

    // ── Kosten ──
    const materialkosten = Math.round(weightG * pricePerGram * 100) / 100;
    const maschinenkosten = Math.round((druckzeitMinuten / 60) * maschinenzeit * 100) / 100;
    const supportNachbearbeitung = hatSupport
      ? Math.round((materialkosten + maschinenkosten) * (komplexitaets_aufschlag / 100) * 100) / 100
      : 0;

    const preisProStueck = Math.round((materialkosten + maschinenkosten + supportNachbearbeitung) * 100) / 100;

    const qty = Math.max(1, Number(quantity) || 1);
    let discount = 0;
    if (qty >= 10) discount = 0.15;
    else if (qty >= 5) discount = 0.1;

    const teilpreis = preisProStueck * qty * (1 - discount);
    const zwischensumme = teilpreis + setupFee;
    const versand = zwischensumme < versandkostenfrei_ab ? versandkosten : 0;
    const gesamtpreis = Math.round(Math.max(zwischensumme + versand, minPrice) * 100) / 100;

    // ── Erklärtext (KI, mit Fallback) ──
    let begruendung = `Bei ${volumeCm3.toFixed(1)} cm³ Volumen und ${infill}% Füllung wiegt dein Teil ca. ${weightG.toFixed(1)} g. Die Druckzeit von ca. ${druckzeitMinuten} Minuten ergibt sich aus Schichthöhe ${layerHeight} mm und Qualitätsstufe "${qualityKey}".`;
    let hinweisFuerKunden = hatSupport
      ? "Für Überhänge brauchen wir Stützmaterial – das kostet etwas Nachbearbeitung. Eine leichte Änderung der Geometrie könnte den Preis senken."
      : "Dein Teil lässt sich ohne Stützmaterial drucken – das hält den Preis tief.";

    // KI-Werte (nur gesetzt, wenn plausibel)
    let ki: Record<string, number> | null = null;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey) {
      try {
        const surfaceCm2 = geo.surfaceMm2 / 100;
        const dimX = geo.bbox.x, dimY = geo.bbox.y, dimZ = geo.bbox.z;
        const bestOverhangPct = best.overhang;
        const originalOverhangPct = original.overhang;
        const bestOrientation = best.label;
        const triangleCount = geo.tris.length;
        // Sphärizität: Kugelfläche gleichen Volumens / echte Oberfläche
        const sphericity = geo.surfaceMm2 > 0
          ? (Math.PI ** (1 / 3)) * ((6 * geo.volumeMm3) ** (2 / 3)) / geo.surfaceMm2
          : 1;

        const prompt = `Du bist ein präziser 3D-Druck-Ingenieur für 3DMuscio Schweiz (Bambu Lab H2C, CoreXY-Drucker).

BAUTEIL-DATEN:
Volumen: ${volumeCm3.toFixed(3)} cm³ = ${(volumeCm3 * 1000).toFixed(0)} mm³
Oberfläche: ${surfaceCm2.toFixed(1)} cm²
Abmessungen: ${dimX.toFixed(1)} × ${dimY.toFixed(1)} × ${dimZ.toFixed(1)} mm
Überhänge (nach Orientierungsoptimierung): ${bestOverhangPct.toFixed(1)}%
Sphärizität: ${sphericity.toFixed(4)}
Anzahl Dreiecke: ${triangleCount}
Optimale Ausrichtung: ${bestOrientation}

MATERIAL & QUALITÄT:
Material: ${material} (Dichte: ${density} g/cm³)
Infill: ${infill}%
Schichthöhe: ${layerHeight}mm
SpeedFactor: ${speedFactor}

PREISPARAMETER:
Materialpreis: CHF ${pricePerGram}/g
Maschinenzeit: CHF ${maschinenzeit}/h
Setup-Pauschale: CHF ${setupFee} (einmalig)
Mindestpreis: CHF ${minPrice}
Versand: CHF ${versandkosten} (gratis ab CHF ${versandkostenfrei_ab})
Menge: ${qty} Stück

BERECHNE SCHRITT FÜR SCHRITT:

SCHRITT 1 – GEWICHT:
fillFactor = 0.3 + (1 - 0.3) × (${infill}/100) = ?
weightG = ${volumeCm3.toFixed(3)} × ${density} × fillFactor = ?

SCHRITT 2 – FILAMENTLÄNGE:
filamentVolumeMm3 = ${(volumeCm3 * 1000).toFixed(0)} × fillFactor = ?
filamentLaengeMm = filamentVolumeMm3 / (π × 0.875²) = ?

SCHRITT 3 – BASIS-DRUCKZEIT (Bambu H2C):
Durchschnittliche Druckgeschwindigkeit: 180 mm/s
(inkl. äussere Wände 150mm/s, Infill 300mm/s, Reisen 500mm/s, Starts/Stops)
basisZeitSek = filamentLaengeMm / 180 = ?
basisZeitMin = basisZeitSek / 60 = ?

SCHRITT 4 – KORREKTURFAKTOREN:
qualitaetsFaktor = 0.2 / ${layerHeight} = ?
(0.3mm=0.67 schneller, 0.2mm=1.0 Standard, 0.15mm=1.33, 0.1mm=2.0 langsamer)
ueberhangFaktor = ${bestOverhangPct > overhang_schwellwert
  ? `1 + (${bestOverhangPct.toFixed(1)}/100 × 0.3) = ?`
  : "1.0 (kein Support nötig)"}
komplexitaetsFaktor = ${sphericity < 0.3 ? "1.15 (komplexe Geometrie)" : "1.0 (einfache Geometrie)"}

SCHRITT 5 – FINALE DRUCKZEIT:
druckzeitMin = basisZeitMin × qualitaetsFaktor × ueberhangFaktor × komplexitaetsFaktor = ?
druckzeitStunden = druckzeitMin / 60 = ?

SCHRITT 6 – KOSTEN:
materialkosten = weightG × CHF ${pricePerGram} = ?
maschinenkosten = druckzeitStunden × CHF ${maschinenzeit} = ?
supportNachbearbeitung = ${bestOverhangPct > overhang_schwellwert
  ? bestOverhangPct > 50
    ? "CHF 15-25 (viele Überhänge, aufwändige Nachbearbeitung)"
    : "CHF 5-15 (moderate Überhänge)"
  : "CHF 0 (kein Support nötig)"}

SCHRITT 7 – PREIS PRO STÜCK:
preisProStueck = materialkosten + maschinenkosten + supportNachbearbeitung = ?

SCHRITT 8 – GESAMTPREIS:
mengenrabatt = ${qty >= 10 ? "15%" : qty >= 5 ? "10%" : "0%"}
subtotal = preisProStueck × ${qty} × (1 - mengenrabatt) = ?
gesamtPreis = subtotal + CHF ${setupFee} Setup = ?
versand = gesamtPreis < ${versandkostenfrei_ab} ? CHF ${versandkosten} : 0 = ?
total = gesamtPreis + versand = ?
preisspanne_min = total × 0.9 = ?
preisspanne_max = total × 1.1 = ?

SCHRITT 9 – TEXTE FÜR KUNDEN:
Schreibe eine kurze begruendung (2 Sätze, professionell, erklärt Druckzeit und warum der Preis gerechtfertigt ist).
Schreibe einen hinweis_fuer_kunden (1 Satz, praktisch, z.B. über Ausrichtung oder Support).

Antworte NUR mit diesem JSON (alle ? durch berechnete Werte ersetzen):
{
  "weightG": ?,
  "filamentLaengeMm": ?,
  "druckzeit_minuten": ?,
  "druckzeit_stunden": ?,
  "qualitaetsFaktor": ?,
  "ueberhangFaktor": ?,
  "komplexitaetsFaktor": ?,
  "materialkosten": ?,
  "maschinenkosten": ?,
  "support_nachbearbeitung": ?,
  "preis_pro_stueck": ?,
  "gesamtpreis": ?,
  "gesamtpreis_min": ?,
  "gesamtpreis_max": ?,
  "versand": ?,
  "hat_support": true/false,
  "orientierung": "${bestOrientation}",
  "orientierung_original_ueberhang": ${originalOverhangPct.toFixed(1)},
  "orientierung_beste_ueberhang": ${bestOverhangPct.toFixed(1)},
  "begruendung": "...",
  "hinweis_fuer_kunden": "..."
}`;

        const models = ["anthropic/claude-sonnet-4-5", "google/gemini-2.5-pro", "google/gemini-2.5-flash"];
        let parsed: any = null;
        for (const model of models) {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "Du bist Fertigungsingenieur bei 3DMuscio (Schweizer 3D-Druck-Service). Rechne exakt Schritt für Schritt und antworte ausschliesslich mit gültigem JSON." },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const raw = data?.choices?.[0]?.message?.content ?? "{}";
            try {
              parsed = JSON.parse(raw);
            } catch {
              const m = String(raw).match(/\{[\s\S]*\}/);
              parsed = m ? JSON.parse(m[0]) : null;
            }
            if (parsed) break;
          } else if (resp.status === 429 || resp.status >= 500 || resp.status === 400) {
            console.warn("AI-Modell nicht verfügbar", model, resp.status);
            continue;
          } else {
            console.warn("AI-Aufruf abgelehnt", model, resp.status);
            break;
          }
        }

        if (parsed) {
          if (parsed.begruendung) begruendung = String(parsed.begruendung);
          if (parsed.hinweis_fuer_kunden) hinweisFuerKunden = String(parsed.hinweis_fuer_kunden);
          const num = (v: unknown) => {
            const n = typeof v === "number" ? v : parseFloat(String(v));
            return Number.isFinite(n) && n >= 0 ? n : null;
          };
          const kiWeight = num(parsed.weightG);
          const kiZeit = num(parsed.druckzeit_minuten);
          const kiPreis = num(parsed.gesamtpreis);
          // Plausibilitätsprüfung: KI-Werte nur in sinnvollen Bandbreiten übernehmen
          if (kiWeight && kiZeit && kiPreis && kiZeit >= 3 && kiZeit <= 60 * 200 && kiPreis >= minPrice * 0.5) {
            ki = {
              weightG: Math.round(kiWeight * 10) / 10,
              filamentLaengeMm: num(parsed.filamentLaengeMm) ?? 0,
              druckzeit_minuten: Math.round(kiZeit),
              materialkosten: num(parsed.materialkosten) ?? 0,
              maschinenkosten: num(parsed.maschinenkosten) ?? 0,
              support_nachbearbeitung: num(parsed.support_nachbearbeitung) ?? 0,
              preis_pro_stueck: num(parsed.preis_pro_stueck) ?? 0,
              gesamtpreis: Math.round(Math.max(kiPreis, minPrice) * 100) / 100,
              gesamtpreis_min: num(parsed.gesamtpreis_min) ?? Math.round(kiPreis * 0.9 * 100) / 100,
              gesamtpreis_max: num(parsed.gesamtpreis_max) ?? Math.round(kiPreis * 1.1 * 100) / 100,
              versand: num(parsed.versand) ?? versand,
            };
          }
        }
      } catch (aiErr) {
        console.warn("AI-Berechnung fehlgeschlagen", aiErr);
      }
    }


    return json({
      fileName: fileName || null,
      volumeCm3: Math.round(volumeCm3 * 10) / 10,
      surfaceCm2: Math.round(geo.surfaceMm2 / 100),
      bbox: geo.bbox,
      triangles: geo.tris.length,
      weightG: ki?.weightG ?? weightG,
      filament_laenge_mm: ki?.filamentLaengeMm ?? null,
      druckzeit_minuten: ki?.druckzeit_minuten ?? druckzeitMinuten,
      materialkosten: ki?.materialkosten ?? materialkosten,
      maschinenkosten: ki?.maschinenkosten ?? maschinenkosten,
      support_nachbearbeitung: ki?.support_nachbearbeitung ?? supportNachbearbeitung,
      preis_pro_stueck: ki?.preis_pro_stueck ?? preisProStueck,
      mengenrabatt: discount,
      gesamtpreis: ki?.gesamtpreis ?? gesamtpreis,
      gesamtpreis_min: ki?.gesamtpreis_min ?? Math.round(gesamtpreis * 0.9 * 100) / 100,
      gesamtpreis_max: ki?.gesamtpreis_max ?? Math.round(gesamtpreis * 1.1 * 100) / 100,
      versand: ki?.versand ?? versand,
      berechnet_von: ki ? "ki" : "heuristik",
      setup_pauschale: setupFee,
      hat_support: hatSupport,
      orientierung: best.label,
      orientierung_original_ueberhang: Math.round(original.overhang),
      orientierung_beste_ueberhang: Math.round(best.overhang),
      begruendung,
      hinweis_fuer_kunden: hinweisFuerKunden,
    });
  } catch (e) {
    console.error("analyze-stl Fehler", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
