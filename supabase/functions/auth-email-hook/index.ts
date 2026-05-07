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
  try {
    payload = await req.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const user = payload?.user
  const emailData = payload?.email_data
  if (!user?.email || !emailData?.email_action_type) {
    console.error('Invalid auth hook payload', { hasUser: !!user, hasEmailData: !!emailData })
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const emailType = emailData.email_action_type
  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Build the confirmation URL from token_hash + redirect_to
  const siteUrl = emailData.site_url || `https://${ROOT_DOMAIN}`
  const redirectTo = emailData.redirect_to || siteUrl
  const verifyType = emailType === 'signup' || emailType === 'email_change' ? 'signup' : emailType === 'recovery' ? 'recovery' : emailType === 'magiclink' ? 'magiclink' : emailType === 'invite' ? 'invite' : emailType
  const confirmationUrl = emailData.token_hash
    ? `${siteUrl.replace(/\/$/, '')}/auth/v1/verify?token=${emailData.token_hash}&type=${verifyType}&redirect_to=${encodeURIComponent(redirectTo)}`
    : redirectTo

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: user.email,
    confirmationUrl,
    token: emailData.token,
    email: user.email,
    oldEmail: user.email,
    newEmail: payload?.user?.new_email || user.email,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))

  const resend = new Resend(resendKey)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      reply_to: REPLY_TO,
      to: user.email,
      subject: EMAIL_SUBJECTS[emailType] || 'Benachrichtigung',
      html,
    })
    if (error) {
      console.error('Resend send error', { error, emailType, to: user.email })
      return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    console.log('Auth email sent via Resend', { emailType, to: user.email, id: data?.id })
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
