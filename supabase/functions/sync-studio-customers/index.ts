import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STUDIO_URL = "https://wkbxnicjqisiftyaodba.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const studioKey = Deno.env.get("STUDIO_SERVICE_ROLE_KEY");
    if (!studioKey?.trim()) {
      throw new Error("STUDIO_SERVICE_ROLE_KEY not configured");
    }

    // Dashboard (target) client
    const dashboardUrl = Deno.env.get("SUPABASE_URL")!;
    const dashboardKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dashboardClient = createClient(dashboardUrl, dashboardKey);

    // Studio source client (service role bypasses RLS)
    const studioClient = createClient(STUDIO_URL, studioKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch profiles via service role client
    const { data: profiles, error: profilesError } = await studioClient
      .from("profiles")
      .select("*");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    console.log(`Fetched ${profiles?.length ?? 0} profiles from Studio`);

    // 2. Fetch users from Studio auth admin
    const usersRes = await fetch(`${STUDIO_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: {
        "apikey": studioKey,
        "Authorization": `Bearer ${studioKey}`,
      },
    });

    if (!usersRes.ok) {
      const err = await usersRes.text();
      throw new Error(`Failed to fetch users: ${usersRes.status} ${err}`);
    }

    const usersData = await usersRes.json();
    const users = usersData.users || [];
    console.log(`Fetched ${users.length} users from Studio Auth`);

    const usersMap = new Map<string, string>();
    for (const user of users) {
      if (user.email) usersMap.set(user.id, user.email);
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

    for (const profile of (profiles ?? [])) {
      const email = usersMap.get(profile.user_id);
      if (!email || existingEmails.has(email.toLowerCase())) {
        skipped++;
        continue;
      }

      const nameParts = (profile.full_name || "").trim().split(" ");
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
      JSON.stringify({ success: true, synced, skipped, total: profiles?.length ?? 0 }),
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
