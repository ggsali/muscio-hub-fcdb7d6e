import { createFileRoute } from '@tanstack/react-router'

/**
 * Öffentlicher Tracking-Endpunkt für das Bewertungs-Mail.
 *
 *  GET /api/public/track-email?type=open&id=<orderId>
 *      → setzt bewertungsmail_geoeffnet_at (nur falls noch null), liefert 1x1-GIF
 *  GET /api/public/track-email?type=click&id=<orderId>&redirect=<url>
 *      → setzt bewertungslink_geklickt_at (nur falls noch null), leitet weiter
 */

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pixelResponse() {
  return new Response(PIXEL as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Content-Length': String(PIXEL.byteLength),
    },
  })
}

function safeRedirect(raw: string | null): string {
  if (!raw) return 'https://3dmuscio.com'
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return 'https://3dmuscio.com'
    const host = url.hostname.toLowerCase()
    const allowed =
      host === '3dmuscio.com' || host.endsWith('.3dmuscio.com') ||
      host === 'g.page' || host === 'maps.app.goo.gl' ||
      /^(www\.|search\.|maps\.)?google\.[a-z.]+$/.test(host)
    return allowed ? url.toString() : 'https://3dmuscio.com'
  } catch {
    return 'https://3dmuscio.com'
  }
}

/** Setzt den Zeitstempel einmalig und schreibt einen Eintrag in den Aktivitätsverlauf. */
async function recordEvent(orderId: string, type: 'open' | 'click', redirectUrl?: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const column = type === 'open' ? 'bewertungsmail_geoeffnet_at' : 'bewertungslink_geklickt_at'

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`id, ${column}`)
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return
  if ((order as Record<string, unknown>)[column]) return // schon erfasst

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('orders')
    .update({ [column]: now } as never)
    .eq('id', orderId)

  const plattform = redirectUrl && /google\./i.test(redirectUrl)
    ? 'Google'
    : redirectUrl && /3dmuscio\.com/i.test(redirectUrl)
      ? 'Bewertungsseite 3DMuscio'
      : null

  await supabaseAdmin.from('order_status_log').insert({
    order_id: orderId,
    status: type === 'open' ? 'bewertungsmail_geoeffnet' : 'bewertungslink_geklickt',
    notiz:
      type === 'open'
        ? '👁 Bewertungsmail geöffnet'
        : `🔗 Bewertungslink angeklickt${plattform ? ` · Plattform: ${plattform}` : ''}`,
  } as never)
}

export const Route = createFileRoute('/api/public/track-email')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type')
        const id = url.searchParams.get('id') || ''
        const redirect = safeRedirect(url.searchParams.get('redirect'))

        if (UUID_RE.test(id) && (type === 'open' || type === 'click')) {
          try {
            await recordEvent(id, type, type === 'click' ? redirect : undefined)
          } catch (e) {
            console.error('[track-email] failed', e)
          }
        }

        if (type === 'click') {
          return new Response(null, {
            status: 302,
            headers: { Location: redirect, 'Cache-Control': 'no-store' },
          })
        }
        return pixelResponse()
      },
    },
  },
})
