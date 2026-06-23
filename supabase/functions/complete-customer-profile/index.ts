import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')
      if (!token) {
        return new Response(JSON.stringify({ error: 'token required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: tok } = await admin
        .from('customer_profile_completion_tokens')
        .select('*, customers(id, vorname, name, firma, email, telefon, strasse, hausnummer, plz, ort, land)')
        .eq('token', token).maybeSingle()
      if (!tok) {
        return new Response(JSON.stringify({ error: 'invalid' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (tok.used_at) {
        return new Response(JSON.stringify({ error: 'used' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (new Date(tok.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: 'expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const isNewCustomer = !tok.customer_id
      return new Response(JSON.stringify({
        ok: true,
        new_customer: isNewCustomer,
        customer: tok.customers || {},
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { token, vorname, name, firma, telefon, strasse, hausnummer, plz, ort, land } = body || {}
      if (!token) {
        return new Response(JSON.stringify({ error: 'token required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: tok } = await admin
        .from('customer_profile_completion_tokens')
        .select('*').eq('token', token).maybeSingle()
      if (!tok) {
        return new Response(JSON.stringify({ error: 'invalid' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (tok.used_at) {
        return new Response(JSON.stringify({ error: 'used' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (new Date(tok.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: 'expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const str = (v: any) => (typeof v === 'string' ? v.trim().slice(0, 200) : null)
      const update: Record<string, any> = {}
      if (str(vorname)) update.vorname = str(vorname)
      if (str(name)) update.name = str(name)
      if (firma !== undefined) update.firma = str(firma)
      if (telefon !== undefined) update.telefon = str(telefon)
      if (str(strasse)) update.strasse = str(strasse)
      if (hausnummer !== undefined) update.hausnummer = str(hausnummer)
      if (str(plz)) update.plz = str(plz)
      if (str(ort)) update.ort = str(ort)
      if (str(land)) update.land = str(land)

      // legacy adresse field
      const adresseParts = []
      if (update.strasse || update.hausnummer) adresseParts.push(`${update.strasse || ''} ${update.hausnummer || ''}`.trim())
      if (update.plz || update.ort) adresseParts.push(`${update.plz || ''} ${update.ort || ''}`.trim())
      if (update.land && update.land !== 'Schweiz') adresseParts.push(update.land)
      if (adresseParts.length) update.adresse = adresseParts.join(', ')

      const { error: updErr } = await admin
        .from('customers').update(update).eq('id', tok.customer_id)
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await admin
        .from('customer_profile_completion_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tok.id)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
