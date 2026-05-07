/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Passwort zurücksetzen für 3DMuscio</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <img
            src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
            alt="3DMuscio"
            width={48}
            height={48}
            style={logoImg}
          />
          <span style={logo}>3DMuscio</span>
        </div>
        <Heading style={h1}>Passwort zurücksetzen</Heading>
        <Text style={text}>
          Wir haben eine Anfrage erhalten, dein Passwort für 3DMuscio zurückzusetzen. Klicke auf den Button um ein neues Passwort zu wählen.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Passwort zurücksetzen
        </Button>
        <Text style={footer}>
          Falls du keine Passwort-Zurücksetzung angefordert hast, kannst du diese E-Mail ignorieren.
        </Text>
        <Hr style={divider} />
        <Text style={footerText}>
          <a href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</a>
          {'  ·  '}
          <span>+41 79 839 50 80</span>
          {'  ·  '}
          <a href="https://3dmuscio.com" style={footerLink}>3dmuscio.com</a>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = {
  backgroundColor: '#18181b',
  borderRadius: '12px',
  padding: '20px 24px',
  marginBottom: '28px',
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: '14px',
}
const logoImg = { borderRadius: '8px', display: 'block' as const }
const logo = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const button = {
  backgroundColor: '#18181b',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 16px' }
const footerText = { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const }
const footerLink = { color: '#ea580c', textDecoration: 'none' }
