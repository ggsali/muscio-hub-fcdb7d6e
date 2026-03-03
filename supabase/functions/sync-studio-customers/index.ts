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

    const dashboardUrl = Deno.env.get("SUPABASE_URL")!;
    const dashboardKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dashboardClient = createClient(dashboardUrl, dashboardKey);

    // 1. Fetch all users from Studio Auth Admin API (bypasses PostgREST entirely)
    let allUsers: any[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${STUDIO_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
        headers: {
          "apikey": studioKey,
          "Authorization": `Bearer ${studioKey}`,
        },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to fetch users: ${res.status} ${err}`);
      }
      const data = await res.json();
      const users = data.users || [];
      allUsers = allUsers.concat(users);
      if (users.length < 1000) break;
      page++;
    }
    console.log(`Fetched ${allUsers.length} users from Studio Auth`);

    // 2. Fetch profiles via raw SQL through Auth Admin (use RPC workaround via REST with service key)
    // Since PostgREST cache is broken, query via the DB REST endpoint with raw query param
    const profilesRes = await fetch(
      `${STUDIO_URL}/rest/v1/rpc/get_all_profiles`,
      {
        method: "POST",
        headers: {
          "apikey": studioKey,
          "Authorization": `Bearer ${studioKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    let profiles: any[] = [];
    if (profilesRes.ok) {
      profiles = await profilesRes.json();
      console.log(`Fetched ${profiles.length} profiles via RPC`);
    } else {
      // Fallback: build from user metadata only
      console.log("RPC not available, building from user metadata");
      profiles = allUsers.map((u) => ({
        user_id: u.id,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || "",
        address: u.user_metadata?.address || null,
        postal_code: u.user_metadata?.postal_code || null,
        city: u.user_metadata?.city || null,
        country: u.user_metadata?.country || null,
        phone: u.user_metadata?.phone || null,
      }));
    }

    // 3. Build user email map
    const usersMap = new Map<string, string>();
    for (const user of allUsers) {
      if (user.email) usersMap.set(user.id, user.email);
    }

    // 4. Fetch existing customer emails from dashboard
    const { data: existingCustomers } = await dashboardClient
      .from("customers")
      .select("email");

    const existingEmails = new Set(
      (existingCustomers || []).map((c: { email: string | null }) => c.email?.toLowerCase())
    );

    // 5. Sync profiles → customers
    let synced = 0;
    let skipped = 0;

    for (const profile of profiles) {
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
      JSON.stringify({ success: true, synced, skipped, total: profiles.length }),
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
