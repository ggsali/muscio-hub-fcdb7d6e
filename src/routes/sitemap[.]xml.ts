import { createFileRoute } from '@tanstack/react-router';
import { publicManifest } from '@/lib/public-manifests';
export const Route = createFileRoute('/sitemap.xml')({ server: { handlers: { GET: () => publicManifest('sitemap') } } });
