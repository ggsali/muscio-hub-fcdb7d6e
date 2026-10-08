import llms from '@/data/llms.txt?raw';
import full from '@/data/llms-full.txt?raw';
import sitemap from '@/data/sitemap.xml?raw';
import { readPublicResinEnabled } from '@/lib/resin.functions';
import { isResinText, stripResin } from '@/lib/resin-content';

export async function publicManifest(kind: 'llms' | 'full' | 'sitemap'): Promise<Response> {
  const enabled = await readPublicResinEnabled();
  let body = kind === 'sitemap' ? sitemap : kind === 'full' ? full : llms;
  if (!enabled) {
    body = kind === 'sitemap'
      ? body.replace(/<url>[\s\S]*?<\/url>/g, (entry) => isResinText(entry) ? '' : entry)
      : body.split(/\n\n/).map((block) => stripResin(block)).filter(Boolean).join('\n\n');
  }
  return new Response(body, { headers: {
    'Content-Type': kind === 'sitemap' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  } });
}
