import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_customers",
  title: "Kunden suchen",
  description:
    "Sucht Kunden nach Name, Firma oder E-Mail. Nur Kunden, auf die der angemeldete Benutzer Zugriff hat.",
  inputSchema: {
    search: z.string().optional().describe("Suchbegriff für Name, Firma oder E-Mail."),
    limit: z.number().int().optional().describe("Maximale Anzahl Ergebnisse (Standard 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("customers")
      .select("id, name, vorname, firma, email, telefon, strasse, hausnummer, plz, ort, land, aktiv, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (search) {
      query = query.or(`name.ilike.%${search}%,firma.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { customers: data ?? [] },
    };
  },
});
