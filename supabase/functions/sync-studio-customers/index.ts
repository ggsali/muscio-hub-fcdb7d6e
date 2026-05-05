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

    // ---- AUTH: require admin ----
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await dashboardClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await dashboardClient
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch all users from Studio Auth Admin API
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
    // Log first user for debug
    if (allUsers.length > 0) {
      console.log(`First user sample: ${JSON.stringify(allUsers[0])}`);
    }

    // 2. Fetch existing customer emails from dashboard
    const { data: existingCustomers } = await dashboardClient
      .from("customers")
      .select("email");

    const existingEmails = new Set(
      (existingCustomers || []).map((c: { email: string | null }) => c.email?.toLowerCase())
    );

    // 3. Sync users → customers (skip admins without confirmed email)
    let synced = 0;
    let skipped = 0;

    for (const user of allUsers) {
      const email = user.email;
      if (!email || existingEmails.has(email.toLowerCase())) {
        skipped++;
        continue;
      }

      // Extract name from user_metadata or raw_user_meta_data
      const meta = user.user_metadata || user.raw_user_meta_data || {};
      const fullName = meta.full_name || meta.name || "";
      const nameParts = fullName.trim().split(" ");
      const vorname = nameParts[0] || "";
      const name = nameParts.slice(1).join(" ") || vorname || "Unbekannt";

      const { error: insertError } = await dashboardClient.from("customers").insert({
        name,
        vorname,
        strasse: meta.address || null,
        plz: meta.postal_code || null,
        ort: meta.city || null,
        land: meta.country || "Schweiz",
        telefon: meta.phone || null,
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
      JSON.stringify({ success: true, synced, skipped, total: allUsers.length }),
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
