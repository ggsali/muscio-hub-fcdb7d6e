import { createFileRoute } from "@tanstack/react-router";

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
    }
  } catch (err) {
    status = "Fehler beim Abrufen";
    detail = err instanceof Error ? err.message : String(err);
  }
  const low = status.toLowerCase();
  return { status, detail, zugestellt: low.includes("zugestellt") || low.includes("delivered") };
}

export const Route = createFileRoute("/api/public/track-shipments-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id, tracking_nr")
          .not("tracking_nr", "is", null)
          .or("tracking_zugestellt.is.null,tracking_zugestellt.eq.false")
          .limit(100);

        if (!orders?.length) return new Response("Keine offenen Sendungen");

        await Promise.allSettled(
          orders.map(async (o: { id: string; tracking_nr: string | null }) => {
            const res = await fetchPostStatus(o.tracking_nr!);
            await supabaseAdmin
              .from("orders")
              .update({
                tracking_status: res.status,
                tracking_status_detail: res.detail,
                tracking_zuletzt_geprueft: new Date().toISOString(),
                tracking_zugestellt: res.zugestellt,
              } as never)
              .eq("id", o.id);
          }),
        );

        return new Response(`${orders.length} Sendungen aktualisiert`);
      },
    },
  },
});
