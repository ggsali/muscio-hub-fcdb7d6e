import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const SITE = 'https://3dmuscio.com'

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/leistungen', changefreq: 'monthly', priority: '0.9' },
  { loc: '/leistungen/fdm-3d-druck', changefreq: 'monthly', priority: '0.8' },
  { loc: '/leistungen/sla-3d-druck', changefreq: 'monthly', priority: '0.8' },
  { loc: '/leistungen/3d-druck-prototypen', changefreq: 'monthly', priority: '0.8' },
  { loc: '/leistungen/3d-druck-ersatzteile', changefreq: 'monthly', priority: '0.8' },
  { loc: '/leistungen/3d-druck-kleinserien', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-druck-zuerich', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-druck-winterthur', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-druck-st-gallen', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-druck-ostschweiz', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-druck-bern', changefreq: 'monthly', priority: '0.8' },
  { loc: '/kalkulator-online', changefreq: 'monthly', priority: '0.9' },

  { loc: '/materialien', changefreq: 'monthly', priority: '0.8' },
  { loc: '/maschinen', changefreq: 'monthly', priority: '0.7' },
  { loc: '/projekte', changefreq: 'weekly', priority: '0.8' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
  { loc: '/ueber-uns', changefreq: 'monthly', priority: '0.7' },
  { loc: '/ueber-ki', changefreq: 'monthly', priority: '0.4' },
  { loc: '/kontakt', changefreq: 'monthly', priority: '0.8' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.5' },
  { loc: '/shop', changefreq: 'weekly', priority: '0.7' },
  { loc: '/agb', changefreq: 'yearly', priority: '0.3' },
  { loc: '/datenschutz', changefreq: 'yearly', priority: '0.3' },
  { loc: '/impressum', changefreq: 'yearly', priority: '0.3' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: posts }, { data: projekte }, { data: products }] = await Promise.all([
      supabase.from('blog_posts').select('slug, updated_at').eq('veroeffentlicht', true),
      supabase.from('projekte').select('slug, updated_at').eq('aktiv', true),
      supabase.from('shop_products').select('slug, updated_at').eq('aktiv', true),
    ])

    const staticXml = STATIC_URLS.map(u => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')

    const dyn = (rows: any[] | null, prefix: string, priority = '0.6') =>
      (rows || []).map((r: any) => `  <url>
    <loc>${SITE}${prefix}/${r.slug}</loc>
    <lastmod>${(r.updated_at || new Date().toISOString()).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${dyn(posts, '/blog')}
${dyn(projekte, '/projekte')}
${dyn(products, '/shop')}
</urlset>`

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: corsHeaders,
    })
  }
})
