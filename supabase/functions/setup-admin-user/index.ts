import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { email, password, secret } = await req.json();
  if (secret !== "muscio-bootstrap-2026") {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }

  // find user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: corsHeaders });
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return new Response(JSON.stringify({ error: "user not found" }), { status: 404, headers: corsHeaders });

  // update password + confirm
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });

  // grant admin role
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
  if (roleErr) return new Response(JSON.stringify({ error: roleErr.message }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ success: true, user_id: user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
