// Dauerhaftes Ratenlimit für öffentliche KI-Funktionen.
// Zählt jeden KI-Aufruf in der Datenbank (gehashte IP, keine Klartext-IP) und prüft
// ein Limit pro Besucher sowie ein Gesamtbudget pro Funktion. Gilt über alle
// Server-Instanzen hinweg, im Gegensatz zu einem reinen Arbeitsspeicher-Zähler.

export type AiRateLimit = {
  bucket: string;
  visitorWindowS: number;
  visitorMax: number;
  globalWindowS: number;
  globalMax: number;
};

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Liefert "ok", "visitor" (Besucherlimit), "global" (Gesamtbudget) oder "error". */
export async function aiRateHit(req: Request, limit: AiRateLimit): Promise<"ok" | "visitor" | "global" | "error"> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "error";
  try {
    const keyHash = await sha256Hex(`${limit.bucket}|${clientIp(req)}|${key.slice(-16)}`);
    const r = await fetch(`${url}/rest/v1/rpc/ai_rate_hit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_bucket: limit.bucket,
        p_key_hash: keyHash,
        p_visitor_window_s: limit.visitorWindowS,
        p_visitor_max: limit.visitorMax,
        p_global_window_s: limit.globalWindowS,
        p_global_max: limit.globalMax,
      }),
    });
    if (!r.ok) {
      console.error("ai_rate_hit fehlgeschlagen", r.status, await r.text());
      return "error";
    }
    const v = await r.json();
    return v === "ok" || v === "visitor" || v === "global" ? v : "error";
  } catch (e) {
    console.error("ai_rate_hit Fehler", e);
    return "error";
  }
}

export function aiRateMessage(result: "visitor" | "global" | "error"): { status: number; error: string } {
  if (result === "visitor") return { status: 429, error: "Zu viele Anfragen. Bitte versuche es später erneut." };
  if (result === "global") return { status: 429, error: "Die KI-Beratung ist für heute ausgelastet. Schreib uns gerne über das Kontaktformular." };
  return { status: 503, error: "Die KI-Beratung ist gerade nicht erreichbar. Bitte versuche es später erneut." };
}
