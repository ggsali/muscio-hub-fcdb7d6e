import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_order",
  title: "Auftrag im Detail",
  description:
    "Liefert einen einzelnen Auftrag inklusive Teile (parts) und Rechnungen (bills) anhand der Auftrags-ID.",
  inputSchema: {
    order_id: z.string().describe("UUID des Auftrags."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!order) {
      return { content: [{ type: "text", text: "Auftrag nicht gefunden oder kein Zugriff." }], isError: true };
    }
    const [{ data: parts }, { data: bills }] = await Promise.all([
      supabase.from("parts").select("*").eq("order_id", order_id),
      supabase.from("bills").select("*").eq("order_id", order_id),
    ]);
    const result = { order, parts: parts ?? [], bills: bills ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
