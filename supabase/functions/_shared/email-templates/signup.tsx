/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Bestätige deine E-Mail-Adresse für 3DMuscio</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>3D<span style={brandAccent}>MUSCIO</span></Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Willkommen bei 3DMuscio!</Heading>
          <Text style={text}>
            Vielen Dank für deine Registrierung. Bitte bestätige deine E-Mail-Adresse{' '}
            <strong>{recipient}</strong>, um dein Kundenkonto zu aktivieren.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button style={button} href={confirmationUrl}>
              E-Mail bestätigen
            </Button>
          </Section>
          <Text style={smallText}>
            Oder kopiere diesen Link in deinen Browser:
          </Text>
          <Text style={linkText}>
            <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
          </Text>
          <Text style={footer}>
            Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.
          </Text>
        </Section>
        <Text style={signature}>
          Dein 3DMuscio Team · <Link href={siteUrl} style={link}>3dmuscio.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '0 16px' }
const header = { textAlign: 'center' as const, padding: '16px 0 24px' }
const brand = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a1a', letterSpacing: '1px', margin: 0 }
const brandAccent = { color: '#FF5A00' }
const card = { backgroundColor: '#f7f7f8', borderRadius: '12px', padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#71717a', margin: '24px 0 4px' }
const linkText = { fontSize: '12px', color: '#FF5A00', wordBreak: 'break-all' as const, margin: '0 0 24px' }
const link = { color: '#FF5A00', textDecoration: 'underline' }
const button = {
  backgroundColor: '#FF5A00',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#a1a1aa', margin: '24px 0 0' }
const signature = { fontSize: '12px', color: '#a1a1aa', textAlign: 'center' as const, margin: '24px 0 0' }
