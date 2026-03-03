import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Studio (source) client with service_role key
    const studioUrl = Deno.env.get("STUDIO_SUPABASE_URL");
    const studioKey = Deno.env.get("STUDIO_SERVICE_ROLE_KEY");
    if (!studioUrl || !studioKey) {
      throw new Error("STUDIO_SUPABASE_URL or STUDIO_SERVICE_ROLE_KEY not configured");
    }

    const studioClient = createClient(studioUrl, studioKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "public" },
    });

    // Dashboard (target) client with service_role key
    const dashboardUrl = Deno.env.get("SUPABASE_URL")!;
    const dashboardKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dashboardClient = createClient(dashboardUrl, dashboardKey);

    // 1. Fetch all profiles from Studio project
    const { data: profiles, error: profilesError } = await studioClient
      .from("profiles")
      .select("*");

    if (profilesError) {
      throw new Error(`Error fetching studio profiles: ${profilesError.message}`);
    }

    // 2. Fetch emails from Studio auth.users (service_role has access)
    const { data: authData, error: authError } = await studioClient.auth.admin.listUsers();
    if (authError) {
      throw new Error(`Error fetching studio users: ${authError.message}`);
    }

    const usersMap = new Map<string, string>();
    for (const user of authData.users) {
      if (user.email) {
        usersMap.set(user.id, user.email);
      }
    }

    // 3. Fetch existing customer emails from dashboard
    const { data: existingCustomers } = await dashboardClient
      .from("customers")
      .select("email");

    const existingEmails = new Set(
      (existingCustomers || []).map((c: { email: string | null }) => c.email?.toLowerCase())
    );

    // 4. Sync profiles → customers
    let synced = 0;
    let skipped = 0;

    for (const profile of profiles || []) {
      const email = usersMap.get(profile.user_id);
      if (!email || existingEmails.has(email.toLowerCase())) {
        skipped++;
        continue;
      }

      const nameParts = (profile.full_name || "").split(" ");
      const vorname = nameParts[0] || "";
      const name = nameParts.slice(1).join(" ") || vorname;

      const { error: insertError } = await dashboardClient.from("customers").insert({
        name: name || "Unbekannt",
        vorname,
        strasse: profile.address || null,
        plz: profile.postal_code || null,
        ort: profile.city || null,
        land: profile.country || "Schweiz",
        telefon: profile.phone || null,
        email,
        notizen: "Automatisch aus 3D Print Studio importiert",
      });

      if (insertError) {
        console.error(`Failed to insert ${email}: ${insertError.message}`);
        skipped++;
      } else {
        synced++;
        existingEmails.add(email.toLowerCase());
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced, skipped, total: profiles?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
