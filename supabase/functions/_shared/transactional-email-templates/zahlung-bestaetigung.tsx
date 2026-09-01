/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  BRAND, EmailFooter, EmailHeader, SITE_NAME, card, container, formattedName,
  h1, infoBox, main, text,
} from './layout.tsx'

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
        <EmailHeader emoji="💳" />
        <Section style={card}>
          <Section style={infoBox}>
            <Text style={successTitle}>✅ Zahlung erfolgreich eingegangen</Text>
            {orderNr ? <Text style={successSub}>Auftrag Nr. {orderNr}</Text> : null}
          </Section>

          <Heading style={h1}>{customerName ? `Vielen Dank, ${formattedName(customerName)}!` : 'Vielen Dank!'}</Heading>
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
        </Section>
        <EmailFooter />
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

const successTitle: React.CSSProperties = { margin: 0, fontSize: '15px', fontWeight: 700, color: '#047857' }
const successSub: React.CSSProperties = { margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }
const amountBox: React.CSSProperties = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 18px', margin: '16px 0 20px' }
const amountLabel: React.CSSProperties = { margin: '0 0 4px', fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
const amountValue: React.CSSProperties = { margin: 0, fontSize: '22px', fontWeight: 700, color: BRAND }
