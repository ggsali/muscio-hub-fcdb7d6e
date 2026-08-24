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

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface Tri {
  nx: number; ny: number; nz: number; area: number;
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
    if (dot < limit) over += t.area;
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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey) {
      try {
        const prompt = `Bauteil "${fileName || "teil.stl"}": Volumen ${volumeCm3.toFixed(1)} cm³, Oberfläche ${(geo.surfaceMm2 / 100).toFixed(0)} cm², Bounding-Box ${geo.bbox.x.toFixed(0)}×${geo.bbox.y.toFixed(0)}×${geo.bbox.z.toFixed(0)} mm, ${geo.tris.length} Dreiecke.
Material ${material} (CHF ${pricePerGram}/g), Qualität ${qualityKey} (${layerHeight} mm, ${infill}% Infill), Menge ${qty}.
Gewicht ${weightG} g, Druckzeit ${druckzeitMinuten} min, Materialkosten CHF ${materialkosten}, Maschinenkosten CHF ${maschinenkosten}, Support-Nachbearbeitung CHF ${supportNachbearbeitung}.
Beste Orientierung: ${best.label} (Überhang ${original.overhang.toFixed(0)}% → ${best.overhang.toFixed(0)}%). Support nötig: ${hatSupport ? "ja" : "nein"}.

Antworte NUR als JSON: {"begruendung":"<2-3 Sätze, wie sich der Preis zusammensetzt, auf Deutsch, du-Form>","hinweis_fuer_kunden":"<1-2 Sätze konkreter Tipp zu Orientierung/Support/Kosten>"}`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Du bist Fertigungsexperte bei 3DMuscio (Schweizer 3D-Druck-Service). Antworte knapp, sachlich und ausschliesslich als JSON." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw);
          if (parsed?.begruendung) begruendung = String(parsed.begruendung);
          if (parsed?.hinweis_fuer_kunden) hinweisFuerKunden = String(parsed.hinweis_fuer_kunden);
        } else {
          console.warn("AI-Erklärung nicht verfügbar", resp.status);
        }
      } catch (aiErr) {
        console.warn("AI-Erklärung fehlgeschlagen", aiErr);
      }
    }

    return json({
      fileName: fileName || null,
      volumeCm3: Math.round(volumeCm3 * 10) / 10,
      surfaceCm2: Math.round(geo.surfaceMm2 / 100),
      bbox: geo.bbox,
      triangles: geo.tris.length,
      weightG,
      druckzeit_minuten: druckzeitMinuten,
      materialkosten,
      maschinenkosten,
      support_nachbearbeitung: supportNachbearbeitung,
      preis_pro_stueck: preisProStueck,
      mengenrabatt: discount,
      gesamtpreis,
      gesamtpreis_min: Math.round(gesamtpreis * 0.9 * 100) / 100,
      gesamtpreis_max: Math.round(gesamtpreis * 1.15 * 100) / 100,
      versand,
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
