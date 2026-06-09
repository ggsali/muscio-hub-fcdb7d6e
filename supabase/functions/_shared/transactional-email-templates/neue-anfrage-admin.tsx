/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '3DMuscio'

interface Props {
  name?: string
  email?: string
  telefon?: string
  betreff?: string
  nachricht?: string
}

const Email = ({ name, email, telefon, betreff, nachricht }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Neue Anfrage von {name || 'Unbekannt'}{betreff ? ` – ${betreff}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={header}>
          <tr>
            <td width={48} style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
              <img
                src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
                alt={SITE_NAME}
                width={48}
                height={48}
                style={logoImg}
              />
            </td>
            <td style={{ verticalAlign: 'middle', ...logo, lineHeight: '48px' }}>{SITE_NAME}</td>
          </tr>
        </table>
        <Heading style={h1}>Neue Anfrage über die Website</Heading>
        <Text style={text}><strong>Name:</strong> {name || '—'}</Text>
        <Text style={text}><strong>E-Mail:</strong> {email ? <Link href={`mailto:${email}`} style={footerLink}>{email}</Link> : '—'}</Text>
        {telefon ? <Text style={text}><strong>Telefon:</strong> {telefon}</Text> : null}
        <Text style={text}><strong>Betreff:</strong> {betreff || '—'}</Text>
        <Text style={text}><strong>Nachricht:</strong></Text>
        <Text style={quote}>{nachricht || '—'}</Text>
        <Hr style={divider} />
        <Text style={footerText}>
          Diese Anfrage ist im Admin-Bereich unter „Anfragen" einsehbar.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Neue Anfrage: ${data?.betreff || 'Website'}${data?.name ? ` – ${data.name}` : ''}`,
  displayName: 'Admin – Neue Anfrage',
  to: 'info@3dmuscio.com',
  previewData: {
    name: 'Max Muster',
    email: 'max@example.com',
    telefon: '+41 79 123 45 67',
    betreff: 'Angebot',
    nachricht: 'Hallo, ich hätte gerne ein Angebot...',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#FF5A00' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#FF5A00', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 10px' }
const quote: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#52525b', background: '#f4f4f5', borderLeft: '3px solid #FF5A00', padding: '12px 14px', borderRadius: '6px', margin: '0 0 18px', whiteSpace: 'pre-wrap' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#FF5A00', textDecoration: 'none' }
