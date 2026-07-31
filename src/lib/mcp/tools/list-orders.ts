import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "Aufträge auflisten",
  description:
    "Listet Aufträge (orders) auf, die dem angemeldeten Benutzer zugänglich sind. Optional nach Status oder Suchbegriff filtern.",
  inputSchema: {
    status: z.string().optional().describe("Optionaler Status-Filter, z. B. 'offen', 'in_produktion', 'geliefert'."),
    search: z.string().optional().describe("Suchbegriff für Auftragsname oder Beschreibung."),
    limit: z.number().int().optional().describe("Maximale Anzahl Ergebnisse (Standard 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("orders")
      .select("id, name, beschreibung, status, datum, umsatz_total, lieferart, tracking_nr, customer_id, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`name.ilike.%${search}%,beschreibung.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
