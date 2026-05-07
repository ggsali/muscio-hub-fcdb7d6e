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

interface ContactConfirmationProps {
  name?: string
  message?: string
}

const ContactConfirmationEmail = ({ name, message }: ContactConfirmationProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Vielen Dank für Ihre Nachricht an {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <img
            src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
            alt={SITE_NAME}
            width={48}
            height={48}
            style={logoImg}
          />
          <span style={logo}>{SITE_NAME}</span>
        </div>
        <Heading style={h1}>
          {name ? `Vielen Dank, ${name}!` : 'Vielen Dank für Ihre Nachricht!'}
        </Heading>
        <Text style={text}>
          Wir haben Ihre Anfrage erhalten und melden uns so schnell wie möglich bei Ihnen zurück.
        </Text>
        {message ? (
          <>
            <Text style={text}><strong>Ihre Nachricht:</strong></Text>
            <Text style={quote}>{message}</Text>
          </>
        ) : null}
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
  component: ContactConfirmationEmail,
  subject: 'Vielen Dank für Ihre Nachricht – 3DMuscio',
  displayName: 'Kontaktformular-Bestätigung',
  previewData: { name: 'Max Muster', message: 'Ich hätte gerne ein Angebot für ein Custom-Print.' },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#22c55e' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#22c55e', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const quote: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#52525b', background: '#f4f4f5', borderLeft: '3px solid #22c55e', padding: '12px 14px', borderRadius: '6px', margin: '0 0 18px', whiteSpace: 'pre-wrap' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
