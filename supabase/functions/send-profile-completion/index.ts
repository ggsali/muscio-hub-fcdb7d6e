import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SITE_URL = 'https://3dmuscio.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id, _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { customer_id } = await req.json()
    if (!customer_id || typeof customer_id !== 'string') {
      return new Response(JSON.stringify({ error: 'customer_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: customer, error: custErr } = await admin
      .from('customers').select('id, vorname, name, email').eq('id', customer_id).maybeSingle()
    if (custErr || !customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!customer.email) {
      return new Response(JSON.stringify({ error: 'Kunde hat keine E-Mail-Adresse' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const { error: tokErr } = await admin
      .from('customer_profile_completion_tokens')
      .insert({ customer_id, token })
    if (tokErr) {
      return new Response(JSON.stringify({ error: tokErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const completionUrl = `${SITE_URL}/profil-ergaenzen?token=${token}`
    const displayName = [customer.vorname, customer.name].filter(Boolean).join(' ') || customer.name || ''

    // Send via transactional email (use admin client so auth is handled correctly)
    const { data: sendData, error: sendErr } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'profil-vervollstaendigen',
        recipientEmail: customer.email,
        idempotencyKey: `profile-completion-${token}`,
        templateData: { name: displayName, completionUrl },
      },
    })

    if (sendErr) {
      console.error('send-transactional-email failed:', sendErr)
      return new Response(JSON.stringify({ error: 'E-Mail-Versand fehlgeschlagen', detail: sendErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, email: customer.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
