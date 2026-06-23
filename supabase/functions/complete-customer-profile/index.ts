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
      const { token, vorname, name, firma, email, telefon, strasse, hausnummer, plz, ort, land } = body || {}
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
      const fields: Record<string, any> = {}
      if (str(vorname)) fields.vorname = str(vorname)
      if (str(name)) fields.name = str(name)
      if (firma !== undefined) fields.firma = str(firma)
      if (telefon !== undefined) fields.telefon = str(telefon)
      if (str(strasse)) fields.strasse = str(strasse)
      if (hausnummer !== undefined) fields.hausnummer = str(hausnummer)
      if (str(plz)) fields.plz = str(plz)
      if (str(ort)) fields.ort = str(ort)
      if (str(land)) fields.land = str(land)

      // legacy adresse field
      const adresseParts = []
      if (fields.strasse || fields.hausnummer) adresseParts.push(`${fields.strasse || ''} ${fields.hausnummer || ''}`.trim())
      if (fields.plz || fields.ort) adresseParts.push(`${fields.plz || ''} ${fields.ort || ''}`.trim())
      if (fields.land && fields.land !== 'Schweiz') adresseParts.push(fields.land)
      if (adresseParts.length) fields.adresse = adresseParts.join(', ')

      const isNewCustomer = !tok.customer_id

      if (isNewCustomer) {
        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 200) : ''
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          return new Response(JSON.stringify({ error: 'Gültige E-Mail-Adresse erforderlich' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        if (!fields.name || !fields.vorname) {
          return new Response(JSON.stringify({ error: 'Vor- und Nachname erforderlich' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Verknüpfe mit bestehendem Kunden mit gleicher E-Mail oder lege neuen an
        const { data: existing } = await admin
          .from('customers').select('id').eq('email', cleanEmail).maybeSingle()

        let customerId: string
        if (existing?.id) {
          customerId = existing.id
          const { error: updErr } = await admin.from('customers').update(fields).eq('id', customerId)
          if (updErr) {
            return new Response(JSON.stringify({ error: updErr.message }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        } else {
          const insertPayload = { ...fields, email: cleanEmail, aktiv: true, notizen: 'Selbstregistrierung via Profil-Link' }
          const { data: created, error: insErr } = await admin
            .from('customers').insert(insertPayload).select('id').single()
          if (insErr || !created) {
            return new Response(JSON.stringify({ error: insErr?.message || 'Anlegen fehlgeschlagen' }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          customerId = created.id
        }

        await admin
          .from('customer_profile_completion_tokens')
          .update({ used_at: new Date().toISOString(), customer_id: customerId })
          .eq('id', tok.id)
      } else {
        const { error: updErr } = await admin
          .from('customers').update(fields).eq('id', tok.customer_id)
        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        await admin
          .from('customer_profile_completion_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', tok.id)
      }

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
