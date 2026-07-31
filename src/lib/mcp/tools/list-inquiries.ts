import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_inquiries",
  title: "Anfragen auflisten",
  description:
    "Listet eingegangene Anfragen (inquiries) aus Kontaktformular, Kalkulator und Shop auf, optional nach Status gefiltert.",
  inputSchema: {
    status: z.string().optional().describe("Optionaler Status-Filter, z. B. 'neu' oder 'erledigt'."),
    limit: z.number().int().optional().describe("Maximale Anzahl Ergebnisse (Standard 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("inquiries")
      .select("id, name, email, telefon, betreff, nachricht, status, quelle, customer_id, order_id, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { inquiries: data ?? [] },
    };
  },
});
