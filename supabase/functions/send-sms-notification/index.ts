const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isOpeningHours = (): boolean => {
  const now = new Date();
  const swissTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
  const day = swissTime.getDay();
  const hour = swissTime.getHours();
  const minute = swissTime.getMinutes();
  const time = hour * 60 + minute;
  const moFr = day >= 1 && day <= 5 && time >= 8 * 60 && time < 18 * 60;
  const sa = day === 6 && time >= 9 * 60 && time < 14 * 60;
  return moFr || sa;
};

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clamp = (s: unknown, max: number): string => {
  const str = typeof s === "string" ? s : "";
  return str.length > max ? str.slice(0, max) : str;
};

// Per-IP rate limit (in-memory)
const rateStore: Map<string, number[]> = ((globalThis as any).__smsNotifyRate ||= new Map());
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const now = Date.now();
    const arr = (rateStore.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (arr.length >= RATE_MAX) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    arr.push(now);
    rateStore.set(ip, arr);

    const body = await req.json().catch(() => ({}));
    const customerName = clamp(body.customerName, 200);
    const customerEmail = clamp(body.customerEmail, 200);
    const message = clamp(body.message, 2000);
    const rawSessionId = clamp(body.sessionId, 100);
    // Only allow safe session id chars (uuid/hex/dashes)
    const sessionId = /^[a-zA-Z0-9-]+$/.test(rawSessionId) ? rawSessionId : "";

    console.log("Chat notification triggered", {
      hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
      isOpeningHours: isOpeningHours(),
    });

    if (!isOpeningHours()) {
      return new Response(
        JSON.stringify({ success: true, insideOpeningHours: false, message: "Ausserhalb Öffnungszeiten" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatLink = `https://3dmuscio.com/admin/chat${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ""}`;
    const html = `
      <h2>💬 Neue Chat-Anfrage auf 3dmuscio.com</h2>
      <p><strong>Name:</strong> ${escapeHtml(customerName) || "Nicht angegeben"}</p>
      <p><strong>E-Mail:</strong> ${escapeHtml(customerEmail) || "Nicht angegeben"}</p>
      <p><strong>Nachricht:</strong> ${escapeHtml(message)}</p>
      <p><strong>Zeitpunkt:</strong> ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}</p>
      <p><a href="${chatLink}" style="display:inline-block;padding:10px 18px;background:#FF5A00;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Zur Anfragen-Übersicht →</a></p>
    `;

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "3DMuscio Chat <noreply@3dmuscio.com>",
        to: ["anfrage@3dmuscio.com"],
        subject: `💬 Neue Chat-Nachricht`,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Email send failed", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, insideOpeningHours: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Notification error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
