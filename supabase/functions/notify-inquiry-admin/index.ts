// Stillgelegt: Admin-Benachrichtigungen werden ausschliesslich von submit-inquiry
// nach dem Speichern der Anfrage versendet. Dieser öffentliche Endpunkt versendet
// keine E-Mails mehr.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: "Endpunkt nicht mehr verfügbar" }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
