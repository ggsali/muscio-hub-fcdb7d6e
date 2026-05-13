import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const SITE = 'https://3dmuscio.com'

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/kalkulator-online', changefreq: 'monthly', priority: '0.9' },
  { loc: '/materialien', changefreq: 'monthly', priority: '0.8' },
  { loc: '/maschinen', changefreq: 'monthly', priority: '0.7' },
  { loc: '/projekte', changefreq: 'weekly', priority: '0.8' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
  { loc: '/ueber-uns', changefreq: 'monthly', priority: '0.6' },
  { loc: '/kontakt', changefreq: 'monthly', priority: '0.6' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.5' },
  { loc: '/shop', changefreq: 'weekly', priority: '0.7' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('veroeffentlicht', true)

    const staticXml = STATIC_URLS.map(u => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')

    const blogXml = (posts || []).map((p: any) => `  <url>
    <loc>${SITE}/blog/${p.slug}</loc>
    <lastmod>${(p.updated_at || new Date().toISOString()).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${blogXml}
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
