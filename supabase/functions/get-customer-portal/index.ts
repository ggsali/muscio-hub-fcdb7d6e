import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Verify JWT and get user email
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email;

    // Find customer by email
    const { data: customer } = await supabase
      .from("customers")
      .select("id, vorname, name, firma, email, telefon, strasse, hausnummer, plz, ort")
      .eq("email", email)
      .maybeSingle();

    if (!customer) {
      return new Response(JSON.stringify({ orders: [], inquiries: [], customer: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch orders for this customer
    const { data: orders } = await supabase
      .from("orders")
      .select("id, name, beschreibung, datum, status, umsatz_total, created_at")
      .eq("customer_id", customer.id)
      .order("datum", { ascending: false });

    // Fetch inquiries for this customer
    const { data: inquiries } = await supabase
      .from("inquiries")
      .select("id, betreff, nachricht, status, created_at, quelle")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    return new Response(JSON.stringify({
      customer,
      orders: orders || [],
      inquiries: inquiries || [],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
