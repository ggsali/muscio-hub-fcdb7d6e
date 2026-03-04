/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihr Bestätigungscode</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <span style={logo}>3DM</span>
        </div>
        <Heading style={h1}>Identität bestätigen</Heading>
        <Text style={text}>Verwenden Sie den folgenden Code um Ihre Identität zu bestätigen:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footerNote}>
          Dieser Code läuft in Kürze ab. Falls Sie ihn nicht angefordert haben, können Sie diese E-Mail ignorieren.
        </Text>
        <Hr style={divider} />
        <div style={footerBlock}>
          <Text style={footerText}>
            <a href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</a>
            {'  ·  '}
            <span>+41 79 839 50 80</span>
            {'  ·  '}
            <a href="https://www.3dmuscio.ch" style={footerLink}>www.3dmuscio.ch</a>
          </Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = {
  backgroundColor: '#18181b',
  borderRadius: '8px',
  padding: '20px 24px',
  marginBottom: '28px',
  display: 'flex' as const,
  alignItems: 'center' as const,
}
const logo = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.05em',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 24px',
  letterSpacing: '0.15em',
}
const footerNote = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 16px' }
const footerBlock = { textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#9ca3af', margin: '0' }
const footerLink = { color: '#ea580c', textDecoration: 'none' }
