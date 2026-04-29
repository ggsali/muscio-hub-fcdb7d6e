import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // alle Auth-Users seitenweise holen
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data.users || [];
      allUsers.push(...users);
      if (users.length < 1000) break;
      page++;
    }

    const { data: customers } = await supabase.from("customers").select("id, email, auth_user_id");
    const byEmail = new Map<string, any>();
    (customers || []).forEach(c => { if (c.email) byEmail.set(c.email.toLowerCase(), c); });

    let linked = 0, created = 0, skipped = 0;

    for (const u of allUsers) {
      const email = (u.email || "").toLowerCase();
      if (!email) { skipped++; continue; }
      const existing = byEmail.get(email);
      if (existing) {
        if (!existing.auth_user_id) {
          await supabase.from("customers").update({ auth_user_id: u.id }).eq("id", existing.id);
          linked++;
        } else skipped++;
      } else {
        const meta = u.user_metadata || {};
        const fullName = (meta.full_name || meta.name || "").trim();
        const parts = fullName.split(" ");
        const vorname = parts[0] || "";
        const name = parts.slice(1).join(" ") || vorname || "Unbekannt";
        const { error } = await supabase.from("customers").insert({
          name, vorname, email: u.email,
          telefon: meta.phone || null,
          strasse: meta.address || null,
          plz: meta.postal_code || null,
          ort: meta.city || null,
          land: meta.country || "Schweiz",
          auth_user_id: u.id,
          notizen: "Automatisch von Website-Konto verknüpft",
        });
        if (!error) created++; else skipped++;
      }
    }

    return new Response(JSON.stringify({ ok: true, linked, created, skipped, total: allUsers.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
