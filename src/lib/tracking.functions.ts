import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  orderId: z.string().uuid().nullable().optional(),
  trackingNr: z.string().trim().min(4).max(60),
});

export type TrackingResult = {
  status: string;
  detail: string;
  zugestellt: boolean;
  geprueftAm: string;
};

/** Fragt den öffentlichen Post-CH-Sendungsstatus ab. */
async function fetchPostStatus(nr: string): Promise<{ status: string; detail: string; zugestellt: boolean }> {
  let status = "Unbekannt";
  let detail = "";

  try {
    const res = await fetch(`https://service.post.ch/api/pk/v1/parcel/${encodeURIComponent(nr)}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });

    if (res.ok) {
      const json: any = await res.json();
      const events: any[] = json?.events || json?.parcel?.events || [];
      const latest = events[0];
      if (latest) {
        status = String(latest.description || latest.status || "In Bearbeitung");
        detail = String(latest.timestamp || "");
      } else if (json?.status) {
        status = String(json.status);
      }
    } else {
      const pageRes = await fetch(
        `https://www.post.ch/de/empfangen/sendungen-verfolgen?itemid=${encodeURIComponent(nr)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      const html = await pageRes.text();
      const match = html.match(/<h[1-3][^>]*>([^<]{5,80})<\/h[1-3]>/i);
      if (match?.[1]) status = match[1].trim();
    }
  } catch (err) {
    status = "Fehler beim Abrufen";
    detail = err instanceof Error ? err.message : String(err);
  }

  const low = status.toLowerCase();
  const zugestellt = low.includes("zugestellt") || low.includes("delivered") || low.includes("abgeholt");
  return { status, detail, zugestellt };
}

export const trackShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<TrackingResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { status, detail, zugestellt } = await fetchPostStatus(data.trackingNr);
    const geprueftAm = new Date().toISOString();

    if (data.orderId) {
      await supabase
        .from("orders")
        .update({
          tracking_nr: data.trackingNr,
          tracking_status: status,
          tracking_status_detail: detail,
          tracking_zuletzt_geprueft: geprueftAm,
          tracking_zugestellt: zugestellt,
        } as never)
        .eq("id", data.orderId);
    }

    return { status, detail, zugestellt, geprueftAm };
  });
