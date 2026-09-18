import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scanSchema = z.object({
  fileBase64: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(100),
});

export interface BelegScanResult {
  datum: string | null;
  betrag: number | null;
  text: string | null;
  beleg_nr: string | null;
}

const ANWEISUNG = `Analysiere diesen Kassenzettel oder Beleg und extrahiere folgende Felder:
- datum: Datum im Format YYYY-MM-DD (falls nicht erkennbar: null)
- betrag: Gesamtbetrag als Zahl ohne Währungssymbol (z.B. 45.90)
- text: Kurze Beschreibung max. 60 Zeichen: Lieferant/Shop + was gekauft
- beleg_nr: Belegnummer oder Quittungsnummer (falls vorhanden, sonst null)

Antworte NUR mit validem JSON, ohne Markdown oder Codeblock:
{"datum":"2025-03-15","betrag":45.90,"text":"Migros – Büromaterial","beleg_nr":"1234"}`;

/** Beleg-Foto oder PDF per KI auslesen (nur Admins). */
export const scanBeleg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scanSchema.parse(data))
  .handler(async ({ data, context }): Promise<BelegScanResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("KI ist nicht konfiguriert");

    const dataUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
    const isPdf = data.mimeType === "application/pdf";
    const filePart = isPdf
      ? { type: "input_file", filename: "beleg.pdf", file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: ANWEISUNG }, filePart],
          },
        ],
      }),
    });

    if (resp.status === 429) throw new Error("Zu viele Anfragen, bitte kurz warten.");
    if (resp.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
    if (!resp.ok) {
      console.error("[scanBeleg] AI error", resp.status, await resp.text());
      throw new Error("Beleg-Erkennung fehlgeschlagen");
    }

    const json = (await resp.json()) as {
      output_text?: string;
      output?: { content?: { type?: string; text?: string }[] }[];
    };
    const text =
      json.output_text ??
      json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text ??
      "";
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(match?.[0] ?? "{}") as Record<string, unknown>;
    } catch {
      console.error("[scanBeleg] parse error", text.slice(0, 300));
      return { datum: null, betrag: null, text: null, beleg_nr: null };
    }

    const datum = typeof parsed["datum"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed["datum"])
      ? parsed["datum"]
      : null;
    const betragRaw = Number(parsed["betrag"]);
    return {
      datum,
      betrag: Number.isFinite(betragRaw) && betragRaw !== 0 ? Math.abs(betragRaw) : null,
      text: parsed["text"] ? String(parsed["text"]).slice(0, 120) : null,
      beleg_nr: parsed["beleg_nr"] ? String(parsed["beleg_nr"]).slice(0, 60) : null,
    };
  });
