import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2";

// Slict die Modelldateien einer Anfrage auf dem NAS (Automatik) und schickt dir eine Mail
// mit Link zur Freigabe. Wird nur von submit-inquiry aufgerufen (Service-Role-Schlüssel nötig)
// und nur, wenn in "settings" der Schlüssel auto_slice_enabled = 'true' steht.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const QUALITIES = [0.08, 0.12, 0.16, 0.2];
const MODEL_RE = /\.(stl|obj|3mf)$/i;
const MAX_PARTS = 5;
const MAX_BYTES = 50 * 1024 * 1024;
const SLICE_TIMEOUT_MS = 240_000;
const ADMIN_URL = "https://muscio-hub.lovable.app/admin/slice-freigabe";
const PRINTER_LABELS: Record<string, string> = { k1c: "Creality K1C", k1: "Creality K1", a1: "Bambu Lab A1" };

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function nearestQuality(h: number): string {
  const q = QUALITIES.reduce((best, x) => (Math.abs(x - h) <= Math.abs(best - h) ? x : best), QUALITIES[0]);
  return q.toFixed(2);
}

/** Schichthöhe/Infill aus dem Anhang, sonst aus dem Nachrichtentext "(… (0.2mm, 20% Infill))" */
function partSettings(att: any, nachricht: string): { layer: number; infill: number } {
  let layer = Number(att?.layer_height);
  let infill = Number(att?.infill);
  if (!layer || !infill) {
    const name = String(att?.filename ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`${name}[^;]*?\\((\\d+(?:\\.\\d+)?)\\s*mm,\\s*(\\d+)%\\s*Infill\\)`).exec(nachricht);
    if (m) {
      layer = layer || Number(m[1]);
      infill = infill || Number(m[2]);
    }
  }
  return { layer: layer || 0.2, infill: Math.min(100, Math.max(5, Math.round(infill || 20))) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "Nur POST erlaubt" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if ((req.headers.get("Authorization") || "") !== `Bearer ${serviceKey}`) return reply({ error: "Nicht berechtigt" }, 403);

  const body = await req.json().catch(() => ({}));
  const inquiryId = String(body?.inquiry_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(inquiryId)) return reply({ error: "inquiry_id fehlt" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const { data: flag } = await supabase.from("settings").select("value").eq("key", "auto_slice_enabled").maybeSingle();
  if (flag?.value !== "true") return reply({ skipped: "Automatik ist ausgeschaltet" });

  const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
  const key = Deno.env.get("SLICER_API_KEY") || "";
  if (!base || !key) return reply({ error: "SLICER_URL / SLICER_API_KEY fehlen" }, 500);

  const { data: inquiry } = await supabase.from("inquiries").select("id, name, email, betreff, nachricht, attachments").eq("id", inquiryId).maybeSingle();
  if (!inquiry) return reply({ error: "Anfrage nicht gefunden" }, 404);

  const parts = (Array.isArray(inquiry.attachments) ? inquiry.attachments : [])
    .filter((a: any) => a?.storage_path && MODEL_RE.test(String(a?.filename ?? "")) && !a?.kind)
    .slice(0, MAX_PARTS);
  if (parts.length === 0) return reply({ skipped: "keine Modelldateien" });

  // Antwort sofort; das Slicen läuft im Hintergrund weiter.
  EdgeRuntime.waitUntil(processParts());
  return reply({ accepted: true, parts: parts.length }, 202);

  async function processParts() {
    const results: any[] = [];
    for (const att of parts) {
      const { layer, infill } = partSettings(att, String(inquiry!.nachricht ?? ""));
      const { data: row } = await supabase.from("slice_jobs").insert({
        inquiry_id: inquiryId,
        filename: String(att.filename).slice(0, 200),
        quantity: Math.max(1, Math.floor(Number(att.menge) || 1)),
        material: att.material ?? null,
        farbe: att.farbe ?? null,
        layer_height: layer,
        infill,
        status: "slicing",
      }).select("id").single();
      if (!row) continue;
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(att.bucket || "project-uploads").download(att.storage_path);
        if (dlErr || !blob) throw new Error("Datei konnte nicht geladen werden");
        if (blob.size > MAX_BYTES) throw new Error("Datei grösser als 50 MB");
        const form = new FormData();
        form.append("file", blob, att.filename);
        form.append("quality", nearestQuality(layer));
        form.append("infill", String(infill));
        form.append("material", "pla");
        form.append("supports", "true");
        form.append("orient", "true");
        form.append("enqueue", "false");
        form.append("reference", `anfrage-${inquiryId.slice(0, 8)}`);
        const res = await fetch(`${base}/auto`, {
          method: "POST",
          headers: { "X-API-Key": key },
          body: form,
          signal: AbortSignal.timeout(SLICE_TIMEOUT_MS),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.detail || payload?.error || `Slicer antwortet mit ${res.status}`);
        await supabase.from("slice_jobs").update({
          nas_job_id: payload.job_id,
          printer: payload.printer ?? null,
          stats: payload.stats ?? null,
          assessment: payload.auto?.assessment ?? null,
          status: "pending",
        }).eq("id", row.id);
        results.push({ ok: true, att, payload });
      } catch (e) {
        const msg = e instanceof DOMException && e.name === "TimeoutError" ? "Zeitüberschreitung beim Slicen" : String((e as Error)?.message ?? e);
        await supabase.from("slice_jobs").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", row.id);
        results.push({ ok: false, att, error: msg });
      }
    }
    await sendMail(results);
  }

  async function sendMail(results: any[]) {
    try {
      const rows = results.map((r) => {
        if (!r.ok) {
          return `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(r.att.filename)}</td><td colspan="3" style="padding:8px;border-bottom:1px solid #e5e7eb;color:#b91c1c">Slicen fehlgeschlagen: ${esc(r.error)}</td></tr>`;
        }
        const st = r.payload.stats ?? {};
        const as = r.payload.auto?.assessment ?? {};
        const easy = as.easy === true;
        const note = easy ? "einfach" : `kompliziert${as.reasons?.length ? ` – ${esc(as.reasons.join(", "))}` : ""}`;
        return `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(r.att.filename)}<br><span style="color:#6b7280;font-size:12px">${esc(r.att.menge ?? 1)}× · ${esc(r.att.material ?? "")} ${esc(r.att.farbe ?? "")}</span></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(PRINTER_LABELS[r.payload.printer] ?? r.payload.printer)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${esc(st.print_time_human ?? "–")}<br>${esc(st.filament_g ?? "–")} g</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:${easy ? "#15803d" : "#c2410c"}">${note}</td></tr>`;
      }).join("");
      const allEasy = results.every((r) => r.ok && r.payload.auto?.assessment?.easy === true);
      const tag = allEasy ? "✅ einfach" : "⚠️ kompliziert – bitte genau prüfen";
      const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
      await resend.emails.send({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: ["anfrage@3dmuscio.com"],
        subject: `🖨️ Slice bereit (${tag}) – ${String(inquiry!.name ?? "").replace(/[\r\n]/g, " ")}`,
        html: `
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:640px;margin:0 auto;color:#111827">
            <div style="background:#FF5A00;padding:20px;text-align:center"><h1 style="color:#fff;margin:0;font-size:18px">🖨️ Slice bereit zur Freigabe</h1></div>
            <div style="padding:20px">
              <p>Anfrage von <b>${esc(inquiry!.name)}</b> (${esc(inquiry!.email)}) wurde automatisch auf dem NAS geslict.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr style="text-align:left;color:#6b7280"><th style="padding:8px">Datei</th><th style="padding:8px">Drucker</th><th style="padding:8px">Zeit / Filament</th><th style="padding:8px">Einschätzung</th></tr>
                ${rows}
              </table>
              <p style="text-align:center;margin-top:24px"><a href="${ADMIN_URL}" style="background:#FF5A00;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500">Prüfen und freigeben →</a></p>
              <p style="color:#6b7280;font-size:12px">Nach der Freigabe wird der G-Code in die SimplyPrint-Queue gestellt und der Drucker startet, sobald er frei ist.</p>
            </div>
          </div>`,
      });
    } catch (e) {
      console.error("Freigabe-Mail Fehler:", e);
    }
  }
});
