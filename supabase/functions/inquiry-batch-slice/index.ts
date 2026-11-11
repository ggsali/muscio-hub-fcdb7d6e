import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Slict nach dem Absenden einer Kalkulator-Anfrage die Menge eines Teils (Kopien auf einer Platte, sonst mehrere Platten)
// und legt das Ergebnis im Anhang der Anfrage ab (attachments[i].batch_slice). Beim Erstellen des Auftrags wird es uebernommen.
// Aufruf nur durch submit-inquiry (Service-Role-Schluessel), ein Aufruf pro Anhang: { inquiry_id, index }.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODEL_RE = /\.(stl|obj|3mf)$/i;
const QUALITIES = [0.08, 0.12, 0.16, 0.2];
const SLICE_TIMEOUT_MS = 140_000;
const MAX_DIRECT_BYTES = 100 * 1024 * 1024;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function nearestQuality(h: number): string {
  const q = QUALITIES.reduce((best, x) => (Math.abs(x - h) <= Math.abs(best - h) ? x : best), QUALITIES[0]);
  return q.toFixed(2);
}

/** Schichthoehe/Infill aus dem Anhang, sonst aus dem Nachrichtentext "(… (0.2mm, 20% Infill))" */
function partSettings(att: any, nachricht: string): { layer: number; infill: number } {
  let layer = Number(att?.layer_height);
  let infill = Number(att?.infill);
  if (!layer || !infill) {
    const name = String(att?.filename ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`${name}[^;]*?\\((\\d+(?:\\.\\d+)?)\\s*mm,\\s*(\\d+)%\\s*Infill\\)`).exec(nachricht);
    if (m) { layer = layer || Number(m[1]); infill = infill || Number(m[2]); }
  }
  return { layer: layer || 0.2, infill: Math.min(100, Math.max(5, Math.round(infill || 20))) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "Nur POST erlaubt" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if ((req.headers.get("Authorization") || "") !== `Bearer ${serviceKey}`) return reply({ error: "Nicht berechtigt" }, 403);

  const body = await req.json().catch(() => ({}));
  const inquiryId = String(body?.inquiry_id ?? "");
  const index = Number(body?.index);
  if (!/^[0-9a-f-]{36}$/i.test(inquiryId) || !Number.isInteger(index) || index < 0) return reply({ error: "inquiry_id/index fehlt" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
  const key = Deno.env.get("SLICER_API_KEY") || "";
  if (!base || !key) return reply({ error: "SLICER_URL / SLICER_API_KEY fehlen" }, 500);

  const { data: inquiry } = await supabase.from("inquiries").select("id, nachricht, attachments").eq("id", inquiryId).maybeSingle();
  const att: any = Array.isArray(inquiry?.attachments) ? inquiry!.attachments[index] : null;
  if (!att) return reply({ error: "Anhang nicht gefunden" }, 404);
  const copies = Math.max(1, Math.floor(Number(att.menge) || 1));
  if (!att.storage_path || att.kind || !MODEL_RE.test(String(att.filename ?? "")) || copies < 2) return reply({ skipped: "kein Mengen-Slice noetig" });

  EdgeRuntime.waitUntil(run());
  return reply({ accepted: true }, 202);

  async function speichere(result: Record<string, unknown>) {
    // Anhaenge werden von mehreren Aufrufen (ein Aufruf pro Teil) ergaenzt: neu lesen, ergaenzen, pruefen, ggf. wiederholen
    for (let n = 0; n < 4; n++) {
      const { data: cur } = await supabase.from("inquiries").select("attachments").eq("id", inquiryId).maybeSingle();
      const list: any[] = Array.isArray(cur?.attachments) ? [...cur!.attachments] : [];
      if (!list[index]) return;
      list[index] = { ...list[index], batch_slice: result };
      await supabase.from("inquiries").update({ attachments: list }).eq("id", inquiryId);
      await new Promise((r) => setTimeout(r, 600 + n * 400));
      const { data: chk } = await supabase.from("inquiries").select("attachments").eq("id", inquiryId).maybeSingle();
      if ((chk?.attachments as any[])?.[index]?.batch_slice?.at === result.at) return;
    }
  }

  async function run() {
    const at = new Date().toISOString();
    try {
      const { layer, infill } = partSettings(att, String(inquiry!.nachricht ?? ""));
      const bucket = att.bucket || "project-uploads";
      const ext = (String(att.filename).match(/\.(stl|obj|3mf)$/i)?.[0] ?? ".stl").toLowerCase();

      // Slicer holt grosse Dateien selbst (file_url), sonst laden wir sie hier und reichen sie weiter
      let fileUrl: string | null = null;
      try {
        const h = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
        if (Array.isArray(h?.features) && h.features.includes("file_url")) {
          const { data: su } = await supabase.storage.from(bucket).createSignedUrl(att.storage_path, 600);
          fileUrl = su?.signedUrl ?? null;
        }
      } catch { /* ohne file_url weiter */ }
      let blob: Blob | null = null;
      if (!fileUrl) {
        const { data, error } = await supabase.storage.from(bucket).download(att.storage_path);
        if (error || !data) throw new Error("Datei konnte nicht geladen werden");
        if (data.size > MAX_DIRECT_BYTES) throw new Error("Datei zu gross fuer die Mengenrechnung");
        blob = data;
      }

      const build = (printer: string, kopien: number) => {
        const f = new FormData();
        if (fileUrl) f.append("file_url", fileUrl); else f.append("file", blob!, `upload${ext}`);
        f.append("printer", printer);
        f.append("material", "pla");
        f.append("quality", nearestQuality(layer));
        f.append("infill", String(infill));
        if (kopien > 1) f.append("copies", String(kopien));
        f.append("supports", "true");
        f.append("orient", "true");
        f.append("reference", `anfrage-${inquiryId.slice(0, 8)}-batch`);
        return f;
      };
      const slice = (printer: string, kopien = copies) =>
        fetch(`${base}/slice`, { method: "POST", headers: { "X-API-Key": key }, body: build(printer, kopien), signal: AbortSignal.timeout(SLICE_TIMEOUT_MS) });

      let res!: Response; let used = "a1"; let zuGross = false;
      for (const printer of ["a1", "k1c", "k2plus", "h2c", "xl"]) {
        res = await slice(printer); used = printer; zuGross = false;
        if (res.status !== 422) break;
        const peek = await res.clone().json().catch(() => ({}));
        const d = String(peek?.detail ?? "");
        zuGross = peek?.error === "model_too_large" || peek?.detail?.error === "model_too_large";
        if (!zuGross && !d.includes("Unbekannter Drucker") && !d.includes("Slicen fehlgeschlagen")) break;
      }
      // braucht der kleine Drucker mehrere Platten: K2 Plus vergleichen (weniger Platten = weniger Setups)
      if (res.ok && used !== "k2plus") {
        const p1 = await res.clone().json().catch(() => ({}));
        const n1 = Number(p1?.plates);
        if (Number.isFinite(n1) && n1 > 1) {
          const alt = await slice("k2plus");
          if (alt.ok) {
            const p2 = await alt.clone().json().catch(() => ({}));
            const n2 = Number(p2?.plates);
            if (Number.isFinite(n2) && n2 >= 1 && n2 < n1) { res = alt; used = "k2plus"; }
          }
        }
      }
      let teilen = false;
      if (res.status === 422 && zuGross) { // passt auf keinen Drucker: ein Stueck geteilt auf dem grossen slicen, hochrechnen
        const f = build("xl", 1); f.append("allow_split", "true");
        res = await fetch(`${base}/slice`, { method: "POST", headers: { "X-API-Key": key }, body: f, signal: AbortSignal.timeout(SLICE_TIMEOUT_MS) });
        used = "xl"; teilen = res.ok;
      }
      const payload: any = await res.json().catch(() => ({}));
      const st = payload?.stats;
      if (!res.ok || !st || !(Number(st.filament_g) > 0) || !(Number(st.print_time_s) > 0)) {
        throw new Error(String(payload?.detail?.error ?? payload?.detail ?? payload?.error ?? `Slicer antwortet mit ${res.status}`).slice(0, 200));
      }
      let time = Number(st.print_time_s), grams = Number(st.filament_g), plates = Number(payload?.plates ?? st.plates);
      if (teilen) { time *= copies; grams *= copies; plates = copies; }
      else if (Number(payload?.copies ?? st.copies) !== copies || !(plates >= 1)) throw new Error("Slicer kennt keine Mengenrechnung");
      await speichere({
        ok: true, at, copies, plates: Math.min(500, Math.floor(plates)), printer: used, layer_height: layer, infill,
        print_time_s: Math.round(time), filament_g: Math.round(grams * 10) / 10,
        has_support: !!st.has_support, ...(Number(st.support_grams) > 0 ? { support_g: Number(st.support_grams) * (teilen ? copies : 1) } : {}),
        ...(Number(st.layers) > 0 ? { layers: Number(st.layers) } : {}),
      });
    } catch (e) {
      const msg = e instanceof DOMException && e.name === "TimeoutError" ? "Zeitueberschreitung beim Slicen" : String((e as Error)?.message ?? e);
      await speichere({ ok: false, at, copies, error: msg.slice(0, 300) });
    }
  }
});
