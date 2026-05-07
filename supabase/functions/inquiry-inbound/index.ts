import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inbound-Webhook für eingehende E-Mails (Resend Inbound oder kompatibel).
// Erwartet JSON mit: from, to, subject, text/html, message_id, in_reply_to, references
// verify_jwt = false (öffentlich), Schutz via geheimes URL-Token.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractEmail(s: string): string {
  if (!s) return "";
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

// Quoted-Reply abschneiden (gängige Trenner)
function stripQuoted(text: string): string {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const cutPatterns = [
    /^On .+ wrote:$/i,
    /^Am .+ schrieb .+:$/i,
    /^Von:\s/i, /^From:\s/i,
    /^-----Original Message-----/i,
    /^>{1,}/,
  ];
  const out: string[] = [];
  for (const line of lines) {
    if (cutPatterns.some((p) => p.test(line.trim()))) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Token-Schutz
  const url = new URL(req.url);
  const expected = Deno.env.get("INBOUND_EMAIL_TOKEN");
  const provided = url.searchParams.get("token") || req.headers.get("x-inbound-token");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json();

    // Resend Inbound liefert Daten unter `data` oder direkt
    const data = payload?.data ?? payload;

    const fromRaw = data.from?.email || data.from || data.sender || "";
    const fromEmail = extractEmail(typeof fromRaw === "string" ? fromRaw : fromRaw.email || "");
    const fromName = typeof fromRaw === "object" ? fromRaw.name : null;

    const toArr = Array.isArray(data.to) ? data.to : [data.to];
    const toEmail = extractEmail(typeof toArr[0] === "string" ? toArr[0] : toArr[0]?.email || "info@3dmuscio.com");

    const subject = (data.subject || "").replace(/^(re:|aw:|fwd?:)\s*/i, "").trim();
    const textRaw = data.text || data.plain || "";
    const html = data.html || null;
    const text = stripQuoted(textRaw) || textRaw || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    const messageId = data.message_id || data.messageId || data.headers?.["message-id"] || null;
    const inReplyTo = data.in_reply_to || data.inReplyTo || data.headers?.["in-reply-to"] || null;
    const references: string = data.references || data.headers?.["references"] || "";

    // 1) Versuch: Anfrage über In-Reply-To/References finden
    let inquiryId: string | null = null;
    const refIds = [inReplyTo, ...references.split(/\s+/)].filter(Boolean);
    if (refIds.length) {
      const { data: msgMatch } = await supabase
        .from("inquiry_messages")
        .select("inquiry_id")
        .in("message_id", refIds)
        .limit(1)
        .maybeSingle();
      if (msgMatch?.inquiry_id) inquiryId = msgMatch.inquiry_id;
    }

    // 2) Fallback: offene Anfrage über Absender-Email
    if (!inquiryId && fromEmail) {
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id")
        .eq("email", fromEmail)
        .neq("status", "Erledigt")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inq?.id) inquiryId = inq.id;
    }

    // 3) Letzter Fallback: neue Anfrage anlegen
    if (!inquiryId) {
      const { data: newInq } = await supabase.from("inquiries").insert({
        name: fromName || fromEmail || "Unbekannt",
        email: fromEmail || "unbekannt@unbekannt",
        betreff: subject || "Eingehende E-Mail",
        nachricht: text || "(leer)",
        status: "Neu",
        quelle: "email",
      }).select("id").single();
      inquiryId = newInq?.id ?? null;
    }

    if (!inquiryId) throw new Error("Konnte Anfrage nicht zuordnen oder anlegen");

    await supabase.from("inquiry_messages").insert({
      inquiry_id: inquiryId,
      direction: "in",
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      body: text,
      body_html: html,
      message_id: messageId,
      in_reply_to: inReplyTo,
    });

    // Status zurück auf "Neu" wenn Kunde antwortet
    await supabase.from("inquiries").update({ status: "Neu", updated_at: new Date().toISOString() }).eq("id", inquiryId);

    return new Response(JSON.stringify({ success: true, inquiry_id: inquiryId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("inquiry-inbound error", err);
    return new Response(JSON.stringify({ error: err?.message || "Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
