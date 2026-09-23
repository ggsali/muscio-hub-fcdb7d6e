import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM =
  'You are a slicer screenshot analyzer. Extract print time in hours (decimal) and filament weight in grams from the screenshot. Return ONLY valid JSON: {"druckzeit_h": number, "gewicht_g": number}';

export interface SlicerScanResult {
  druckzeit_h: number | null;
  gewicht_g: number | null;
}

/** Slicer-Screenshot per KI auslesen (nur Admins). */
export const scanSlicer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image_base64: z.string().min(20).max(15_000_000) }).parse(d))
  .handler(async ({ data, context }): Promise<SlicerScanResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("KI ist nicht konfiguriert");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5",
        max_tokens: 300,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.image_base64 } },
              { type: "text", text: "Analysiere diesen Slicer-Screenshot." },
            ],
          },
        ],
      }),
    });

    if (resp.status === 429) throw new Error("Zu viele Anfragen, bitte kurz warten.");
    if (resp.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
    if (!resp.ok) {
      console.error("[scanSlicer] AI error", resp.status, await resp.text());
      throw new Error("Screenshot-Erkennung fehlgeschlagen");
    }
    const json = (await resp.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (json.stop_reason === "refusal") throw new Error("Die KI hat die Analyse abgelehnt.");
    const text = json.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
    try {
      const p = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;
      const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.abs(Number(v)) : null);
      return { druckzeit_h: num(p["druckzeit_h"]), gewicht_g: num(p["gewicht_g"]) };
    } catch {
      return { druckzeit_h: null, gewicht_g: null };
    }
  });
