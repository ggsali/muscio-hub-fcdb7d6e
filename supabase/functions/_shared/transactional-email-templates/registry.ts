/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as contactConfirmation } from './contact-confirmation.tsx'
import { template as welcome } from './welcome.tsx'
import { template as bewertung } from './bewertung.tsx'
import { template as neueAnfrageAdmin } from './neue-anfrage-admin.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-confirmation': contactConfirmation,
  'welcome': welcome,
  'bewertung': bewertung,
  'neue-anfrage-admin': neueAnfrageAdmin,
}
