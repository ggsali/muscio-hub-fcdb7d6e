import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from "npm:resend@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

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

    const { customer_id, mode } = await req.json()
    const linkOnly = mode === 'link'
    const newCustomerMode = mode === 'new-customer'

    let customer: { id: string; vorname?: string | null; name?: string | null; email?: string | null } | null = null

    if (!newCustomerMode) {
      if (!customer_id || typeof customer_id !== 'string') {
        return new Response(JSON.stringify({ error: 'customer_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data, error: custErr } = await admin
        .from('customers').select('id, vorname, name, email').eq('id', customer_id).maybeSingle()
      if (custErr || !data) {
        return new Response(JSON.stringify({ error: 'Customer not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      customer = data
      if (!linkOnly && !customer.email) {
        return new Response(JSON.stringify({ error: 'Kunde hat keine E-Mail-Adresse' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Create token (customer_id may be null for new-customer mode)
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const { error: tokErr } = await admin
      .from('customer_profile_completion_tokens')
      .insert({ customer_id: customer?.id ?? null, token })
    if (tokErr) {
      return new Response(JSON.stringify({ error: tokErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const completionUrl = `${SITE_URL}/profil-ergaenzen?token=${token}`
    const displayName = customer ? ([customer.vorname, customer.name].filter(Boolean).join(' ') || customer.name || '') : ''

    if (newCustomerMode) {
      return new Response(JSON.stringify({ ok: true, url: completionUrl, token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    if (linkOnly) {
      return new Response(JSON.stringify({ ok: true, url: completionUrl, token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // E-Mail direkt via Resend versenden
    const kundenName = displayName || 'Kunde'
    const { error: mailErr } = await resend.emails.send({
      from: '3DMuscio <noreply@3dmuscio.com>',
      to: [customer.email!],
      subject: 'Bitte ergänzen Sie Ihre Adressdaten – 3DMuscio',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
            <div style="background:#1a1a1a;padding:24px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;">📋 Adressdaten ergänzen</h1>
            </div>
            <div style="padding:28px;color:#1f2937;">
              <p style="margin:0 0 16px;">Guten Tag ${kundenName},</p>
              <p style="margin:0 0 20px;line-height:1.6;">
                Für die Verarbeitung Ihres Auftrags benötigen wir noch Ihre vollständigen Adressdaten.
                Bitte klicken Sie auf den Button unten und ergänzen Sie Ihre Angaben.
              </p>
              <p style="margin:0 0 20px;">
                <a href="${completionUrl}" style="display:inline-block;background:#FF5A00;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;">
                  Adressdaten ergänzen →
                </a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Dieser Link ist 30 Tage gültig.</p>
            </div>
            <div style="padding:16px 28px;background:#fafafa;color:#9ca3af;font-size:12px;text-align:center;">
              3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG · <a href="mailto:info@3dmuscio.com" style="color:#9ca3af;">info@3dmuscio.com</a>
            </div>
          </div>
        </div>
      `,
    })

    if (mailErr) {
      console.error('Resend failed:', mailErr)
      return new Response(JSON.stringify({ error: 'E-Mail-Versand fehlgeschlagen', detail: String((mailErr as any).message || mailErr) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, email: customer.email, url: completionUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
