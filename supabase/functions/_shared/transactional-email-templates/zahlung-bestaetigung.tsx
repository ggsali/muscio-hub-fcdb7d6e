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
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '3DMuscio'

interface Props {
  customerName?: string
  orderName?: string
  orderNr?: string
  amountFormatted?: string
}

const Email = ({ customerName, orderName, orderNr, amountFormatted }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Zahlungsbestätigung – {orderName || 'Ihr Auftrag'}</Preview>
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
            <td style={{ verticalAlign: 'middle', ...logoText, lineHeight: '48px' }}>{SITE_NAME}</td>
          </tr>
        </table>

        <Section style={successBox}>
          <Text style={successTitle}>✅ Zahlung erfolgreich eingegangen</Text>
          {orderNr ? <Text style={successSub}>Auftrag Nr. {orderNr}</Text> : null}
        </Section>

        <Heading style={h1}>{customerName ? `Vielen Dank, ${customerName}!` : 'Vielen Dank!'}</Heading>
        <Text style={text}>
          Ihre Zahlung für den Auftrag <strong>„{orderName || 'Ihr Auftrag'}"</strong> wurde erfolgreich verarbeitet.
        </Text>

        {amountFormatted ? (
          <Section style={amountBox}>
            <Text style={amountLabel}>Bezahlter Betrag</Text>
            <Text style={amountValue}>{amountFormatted}</Text>
          </Section>
        ) : null}

        <Text style={text}>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</Text>
        <Text style={text}>
          Mit freundlichen Grüssen<br />
          <strong>{SITE_NAME}</strong>
        </Text>

        <Hr style={divider} />
        <Text style={footerText}>
          <Link href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</Link>
          {'  ·  '}<span>+41 79 839 50 80</span>{'  ·  '}
          <Link href="https://3dmuscio.com" style={footerLink}>3dmuscio.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Zahlungsbestätigung – ${d?.orderName || 'Ihr Auftrag'} | ${SITE_NAME}`,
  displayName: 'Zahlungsbestätigung',
  previewData: {
    customerName: 'Max Muster',
    orderName: 'Custom Print',
    orderNr: 'ABC12345',
    amountFormatted: 'CHF 149.00',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logoText: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#FF5A00' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const successBox: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const successTitle: React.CSSProperties = { margin: 0, fontSize: '15px', fontWeight: 700, color: '#16a34a' }
const successSub: React.CSSProperties = { margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }
const amountBox: React.CSSProperties = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 18px', margin: '16px 0 20px' }
const amountLabel: React.CSSProperties = { margin: '0 0 4px', fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
const amountValue: React.CSSProperties = { margin: 0, fontSize: '22px', fontWeight: 700, color: '#16a34a' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#FF5A00', textDecoration: 'none' }
