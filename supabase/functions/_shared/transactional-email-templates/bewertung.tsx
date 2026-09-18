/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND = '#00cc66'
const LOGO = 'https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg'

interface Props {
  name?: string
  bewertungsLink?: string
  orderId?: string
  [key: string]: any
}

const TRACK_BASE = 'https://3dmuscio.com/api/public/track-email'

const Email = ({ name, bewertungsLink, orderId }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Danke für Ihre Bewertung</Preview>
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
          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }}>Danke für Ihre Bewertung</Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Guten Tag {name || 'Kunde'},
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Ihre Bewertung wurde erfolgreich gespeichert. Wir freuen uns sehr über Ihr Feedback und werden es nutzen, um unseren 3D-Druck-Service kontinuierlich zu verbessern.
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Vielen Dank, dass Sie sich Zeit genommen haben.
          </Text>
          {bewertungsLink ? (
            <Section style={{ textAlign: 'center', padding: '8px 0 0' }}>
              <Link
                href={orderId
                  ? `${TRACK_BASE}?type=click&id=${encodeURIComponent(orderId)}&redirect=${encodeURIComponent(bewertungsLink)}`
                  : bewertungsLink}
                style={{ backgroundColor: BRAND, color: '#ffffff', fontSize: '15px', fontWeight: 700, padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}
              >
                Jetzt bewerten
              </Link>
            </Section>
          ) : null}
        </Section>

        {orderId ? (
          <img
            src={`${TRACK_BASE}?type=open&id=${encodeURIComponent(orderId)}`}
            width={1}
            height={1}
            alt=""
            style={{ display: 'none' }}
          />
        ) : null}


        <Section style={{ padding: '20px 8px 0', textAlign: 'center' }}>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px', textAlign: 'center' }}>3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG</Text>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
            <Link href="mailto:info@3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>info@3dmuscio.com</Link>
            {' · '} +41 77 804 41 22 {' · '}
            <Link href="https://3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>3dmuscio.com</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  subject: 'Danke für Ihre Bewertung',
  displayName: 'Bewertungsbestätigung',
  previewData: { name: 'Max Muster', bewertungsLink: 'https://3dmuscio.com/bewertung/demo', orderId: '00000000-0000-0000-0000-000000000000' },
}
