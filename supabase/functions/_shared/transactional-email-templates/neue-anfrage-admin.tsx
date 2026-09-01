/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  email?: string
  telefon?: string
  betreff?: string
  nachricht?: string
  [key: string]: any
}

const BRAND = '#00cc66'
const LOGO = 'https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg'

const Email = ({ name, email, telefon, betreff, nachricht }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Neue Anfrage eingegangen</Preview>
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
              <td align="right" style={{ verticalAlign: 'middle', fontSize: '26px' }}>🔔</td>
            </tr>
          </table>
        </Section>

        <Section style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '32px 28px' }}>
          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }}>Neue Anfrage eingegangen</Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Es ist eine neue Anfrage über die Website eingegangen.
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            <strong>Name:</strong> {name || '—'}
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            <strong>E-Mail:</strong>{' '}
            {email ? (
              <Link href={`mailto:${email}`} style={{ color: BRAND, textDecoration: 'none' }}>{email}</Link>
            ) : (
              '—'
            )}
          </Text>
          {telefon ? <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}><strong>Telefon:</strong> {telefon}</Text> : null}
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            <strong>Betreff:</strong> {betreff || '—'}
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 8px' }}><strong>Nachricht:</strong></Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#52525b', background: '#f4f4f5', borderLeft: `3px solid ${BRAND}`, padding: '12px 14px', borderRadius: '6px', margin: '0 0 18px', whiteSpace: 'pre-wrap' }}>
            {nachricht || '—'}
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Diese Anfrage ist im Admin-Bereich unter „Anfragen“ einsehbar.
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
  subject: (data: Record<string, any>) => `Neue Anfrage: ${data?.betreff || 'Website'}${data?.name ? ` – ${data.name}` : ''}`,
  displayName: 'Admin – Neue Anfrage',
  to: 'info@3dmuscio.com',
  previewData: { name: 'Max Muster', email: 'max@example.com', telefon: '+41 79 123 45 67', betreff: 'Angebot', nachricht: 'Hallo, ich hätte gerne ein Angebot für ein Custom-Print.' },
}
