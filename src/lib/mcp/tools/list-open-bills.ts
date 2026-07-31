import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_open_bills",
  title: "Offene Rechnungen",
  description:
    "Listet Rechnungen (bills) auf. Standardmässig nur unbezahlte Rechnungen, sortiert nach Fälligkeitsdatum.",
  inputSchema: {
    include_paid: z.boolean().optional().describe("Wenn true, werden auch bezahlte Rechnungen zurückgegeben."),
    limit: z.number().int().optional().describe("Maximale Anzahl Ergebnisse (Standard 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_paid, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bills")
      .select("id, order_id, rechnungsnummer, titel, betrag, faellig_am, bezahlt, bezahlt_am, empfaenger_name, empfaenger_firma, created_at")
      .order("faellig_am", { ascending: true, nullsFirst: false })
      .limit(take);
    if (!include_paid) query = query.eq("bezahlt", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bills: data ?? [] },
    };
  },
});
