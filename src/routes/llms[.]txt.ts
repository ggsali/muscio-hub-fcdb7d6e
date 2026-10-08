import { createFileRoute } from '@tanstack/react-router';
import { publicManifest } from '@/lib/public-manifests';
export const Route = createFileRoute('/llms.txt')({ server: { handlers: { GET: () => publicManifest('llms') } } });
