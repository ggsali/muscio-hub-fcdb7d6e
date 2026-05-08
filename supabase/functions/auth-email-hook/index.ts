import { Resend } from 'npm:resend@4.0.0'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'E-Mail bestätigen',
  invite: 'Du wurdest eingeladen',
  magiclink: 'Dein Login-Link',
  recovery: 'Passwort zurücksetzen',
  email_change: 'Neue E-Mail-Adresse bestätigen',
  reauthentication: 'Dein Verifizierungscode',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = '3DMuscio'
const ROOT_DOMAIN = '3dmuscio.com'
const FROM_ADDRESS = '3DMuscio <noreply@3dmuscio.com>'
const REPLY_TO = 'info@3dmuscio.com'

const SAMPLE_PROJECT_URL = `https://${ROOT_DOMAIN}`
const SAMPLE_EMAIL = 'user@example.test'
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, oldEmail: SAMPLE_EMAIL, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '123456' },
}

async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: previewCorsHeaders })

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' } })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' } })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), { status: 400, headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' } })
  }

  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] || {}))
  return new Response(html, { status: 200, headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}

// Supabase Auth HTTP Hook handler
// Payload format: { user: { email, ... }, email_data: { token, token_hash, redirect_to, email_action_type, site_url, ... } }
async function handleAuthHook(req: Request): Promise<Response> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let payload: any
  let rawBody = ''
  try {
    rawBody = await req.text()
    payload = JSON.parse(rawBody)
  } catch (e) {
    console.error('Invalid JSON in auth hook', { rawBody: rawBody.substring(0, 500) })
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Normalize payload: supports BOTH
  //  (a) standard Supabase auth hook format: { user: {email}, email_data: {email_action_type, token, token_hash, redirect_to, site_url} }
  //  (b) Lovable webhook format:             { type: "auth", data: { action_type, email, token, url, site_url, new_email, old_email, callback_url } }
  let userEmail: string | undefined
  let newEmail: string | undefined
  let emailType: string | undefined
  let token: string | undefined
  let confirmationUrl: string | undefined
  let siteUrl: string = `https://${ROOT_DOMAIN}`

  if (payload?.user?.email && payload?.email_data?.email_action_type) {
    // Standard Supabase format
    userEmail = payload.user.email
    newEmail = payload.user.new_email
    emailType = payload.email_data.email_action_type
    token = payload.email_data.token
    const rawSiteUrl = payload.email_data.site_url || ''
    siteUrl = rawSiteUrl.includes('lovable') || rawSiteUrl.includes('localhost')
      ? `https://${ROOT_DOMAIN}`
      : rawSiteUrl || `https://${ROOT_DOMAIN}`
    const redirectTo = payload.email_data.redirect_to || `https://${ROOT_DOMAIN}`
    const safeRedirectTo = redirectTo.includes('lovable') || redirectTo.includes('localhost')
      ? `https://${ROOT_DOMAIN}/portal`
      : redirectTo
    const verifyType = emailType === 'signup' || emailType === 'email_change' ? 'signup' : emailType
    confirmationUrl = payload.email_data.token_hash
      ? `https://ukqtjdsjmtxgzhklvqky.supabase.co/auth/v1/verify?token=${payload.email_data.token_hash}&type=${verifyType}&redirect_to=${encodeURIComponent(safeRedirectTo)}`
      : safeRedirectTo
  } else if (payload?.data?.email && payload?.data?.action_type) {
    // Lovable webhook format
    const d = payload.data
    userEmail = d.email
    newEmail = d.new_email || undefined
    emailType = d.action_type
    token = d.token || d.new_token
    siteUrl = d.site_url || siteUrl
    const rawUrl = d.url || siteUrl
    confirmationUrl = rawUrl.includes('lovable') || rawUrl.includes('localhost')
      ? `https://${ROOT_DOMAIN}/portal`
      : rawUrl
  } else {
    console.error('Invalid auth hook payload — unknown format', {
      topKeys: Object.keys(payload || {}),
      fullPayload: JSON.stringify(payload).substring(0, 1000),
    })
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (!userEmail || !emailType) {
    console.error('Missing required fields after normalization', { userEmail, emailType })
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: userEmail,
    confirmationUrl: confirmationUrl || siteUrl,
    token: token || '',
    email: userEmail,
    oldEmail: userEmail,
    newEmail: newEmail || userEmail,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))

  const resend = new Resend(resendKey)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      reply_to: REPLY_TO,
      to: userEmail,
      subject: EMAIL_SUBJECTS[emailType] || 'Benachrichtigung',
      html,
    })
    if (error) {
      console.error('Resend send error', { error, emailType, to: userEmail })
      return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    console.log('Auth email sent via Resend', { emailType, to: userEmail, id: data?.id })
    return new Response(JSON.stringify({ success: true, id: data?.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Resend exception', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (url.pathname.endsWith('/preview')) return handlePreview(req)
  try {
    return await handleAuthHook(req)
  } catch (error) {
    console.error('Auth hook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
