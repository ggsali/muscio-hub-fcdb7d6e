/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  bewertungsLink?: string
  [key: string]: any
}

const BRAND = '#00cc66'
const LOGO = 'https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg'
const GOOGLE_REVIEW_URL = 'https://g.page/r/CZWZrGWQTJ_OEAE/review'

const Email = ({ name, bewertungsLink }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Vielen Dank für Ihre Bewertung</Preview>
    <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px' }}>
        <Section style={{ backgroundColor: '#18181b', padding: '20px 28px', borderRadius: '12px 12px 0 0' }}>
          <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ borderCollapse: 'collapse' }}>
            <tr>
              <td width={48} style={{ verticalAlign: 'middle', paddingRight: '14px' }}>
                <img src={LOGO} alt="3DMuscio" width={48} height={48} style={{ borderRadius: '8px', display: 'block' }} />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: '24px' }}>3DMuscio</div>
                <div style={{ fontSize: '12px', color: BRAND, lineHeight: '16px', fontWeight: 600 }}>3D-DRUCK SCHWEIZ</div>
              </td>
              <td align="right" style={{ verticalAlign: 'middle', fontSize: '26px' }}>⭐</td>
            </tr>
          </table>
        </Section>

        <Section style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '32px 28px' }}>
          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }}>Vielen Dank für Ihre Bewertung</Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Guten Tag {name || 'Kunde'},
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Wir freuen uns sehr über Ihre Rückmeldung. Ihre Bewertung hilft uns, unseren 3D-Druck-Service kontinuierlich zu verbessern.
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Noch keine Bewertung abgegeben? Dann nehmen Sie sich gerne eine Minute Zeit:
          </Text>
          <Section style={{ margin: '28px 0 16px', textAlign: 'center' }}>
            <Link
              href={bewertungsLink || GOOGLE_REVIEW_URL}
              style={{ backgroundColor: BRAND, color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }}
            >
              Jetzt bewerten
            </Link>
          </Section>
          <Text style={{ fontSize: '12px', color: '#71717a', margin: '12px 0 0', wordBreak: 'break-all' }}>
            Oder kopieren Sie diesen Link:<br />
            <Link href={bewertungsLink || GOOGLE_REVIEW_URL} style={{ color: BRAND, textDecoration: 'none' }}>{bewertungsLink || GOOGLE_REVIEW_URL}</Link>
          </Text>
        </Section>

        <Section style={{ padding: '20px 8px 0', textAlign: 'center' }}>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px', textAlign: 'center' }}>3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG</Text>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
            <Link href="mailto:info@3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>info@3dmuscio.com</Link>
            {' · '} +41 79 839 50 80 {' · '}
            <Link href="https://3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>3dmuscio.com</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  subject: 'Vielen Dank für Ihre Bewertung',
  displayName: 'Bewertungsanfrage',
  previewData: { name: 'Max Muster', bewertungsLink: 'https://3dmuscio.com/bewertung/abc123' },
}
