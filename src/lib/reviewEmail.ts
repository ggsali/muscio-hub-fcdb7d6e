import { supabase } from "@/integrations/supabase/client";

export const REVIEW_DEFAULT_SUBJECT = "Vielen Dank für Ihren Auftrag – kurze Bitte";

export function buildReviewBody(name: string) {
  return `Guten Tag ${name || ""},

vielen Dank für Ihren Auftrag bei 3DMuscio – es war uns eine Freude, für Sie zu drucken!

Falls Sie einen Moment Zeit haben, würden wir uns sehr über eine kurze Google-Rezension freuen. Ihr Feedback hilft uns sehr und dauert nur 1–2 Minuten:

👉 [Google Rezension schreiben]

Herzlichen Dank und bis zum nächsten Mal!

Freundliche Grüsse
Jorim Moos
3DMuscio`;
}

export interface ReviewMailSettings {
  reviewUrl: string;
  subject: string;
  bodyTemplate: string;
  autoSend: boolean;
}

/** Loads the editable review-mail settings (link, subject, body template, auto-send flag). */
export async function loadReviewMailSettings(): Promise<ReviewMailSettings> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["google_review_url", "review_email_subject", "review_email_body", "review_auto_send"]);
  const map: Record<string, string> = {};
  for (const row of data || []) map[(row as any).key] = (row as any).value ?? "";
  return {
    reviewUrl: map.google_review_url || "",
    subject: map.review_email_subject || REVIEW_DEFAULT_SUBJECT,
    bodyTemplate: map.review_email_body || buildReviewBody("{{name}}"),
    autoSend: map.review_auto_send !== "false",
  };
}

/** Fills {{name}} / {{firma}} placeholders in the template. */
export function fillReviewTemplate(tpl: string, vars: { name?: string; firma?: string }) {
  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, vars.name || "")
    .replace(/\{\{\s*firma\s*\}\}/g, vars.firma || "");
}

/** Returns the timestamp of the last successful review request for an order, or null. */
export async function getReviewRequestLog(orderId: string) {
  const { data } = await supabase
    .from("order_status_log")
    .select("created_at, status, notiz")
    .eq("order_id", orderId)
    .in("status", ["review_request", "review_request_failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { created_at: string; status: string; notiz: string | null } | null;
}

/**
 * Sends the review request mail for an order. Skips silently when auto-send is off,
 * when it was already sent, or when no customer e-mail exists.
 * Failures are written to order_status_log so they stay visible in the admin UI.
 */
export async function sendReviewRequestForOrder(
  orderId: string,
  customerId: string | null,
  opts: { auto?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  const settings = await loadReviewMailSettings();
  if (opts.auto && !settings.autoSend) return { sent: false, reason: "auto_disabled" };

  const existing = await getReviewRequestLog(orderId);
  if (opts.auto && existing?.status === "review_request") return { sent: false, reason: "already_sent" };

  if (!customerId) return { sent: false, reason: "no_customer" };
  const { data: cust } = await supabase
    .from("customers")
    .select("vorname, name, firma, email")
    .eq("id", customerId)
    .maybeSingle();
  const email = (cust as any)?.email || "";
  const name = [(cust as any)?.vorname, (cust as any)?.name].filter(Boolean).join(" ").trim();
  if (!email) {
    await supabase.from("order_status_log").insert({
      order_id: orderId,
      status: "review_request_failed",
      notiz: "Rezensions-Anfrage nicht gesendet: keine E-Mail-Adresse beim Kunden hinterlegt",
    });
    return { sent: false, reason: "no_email" };
  }

  const body = fillReviewTemplate(settings.bodyTemplate, { name, firma: (cust as any)?.firma || "" });

  const { data, error } = await supabase.functions.invoke("send-review-request", {
    body: {
      order_id: orderId,
      subject: settings.subject,
      body,
      customer_email: email,
      customer_name: name,
      review_url: settings.reviewUrl,
    },
  });

  const ok = !error && (data as any)?.success;
  if (!ok) {
    await supabase.from("order_status_log").insert({
      order_id: orderId,
      status: "review_request_failed",
      notiz: `Rezensions-Anfrage an ${email} fehlgeschlagen: ${String((data as any)?.error || error?.message || "Unbekannter Fehler")}`,
    });
    return { sent: false, reason: "error" };
  }
  return { sent: true };
}
