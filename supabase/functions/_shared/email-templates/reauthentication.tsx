/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Dein Bestätigungscode für 3DMuscio</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <img src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg" alt="3DMuscio" width={48} height={48} style={logoImg} />
          <span style={logo}>3DMuscio</span>
        </div>
        <Heading style={h1}>Bestätigungscode</Heading>
        <Text style={text}>Verwende den folgenden Code, um deine Identität zu bestätigen:</Text>
        <div style={codeBox}>{token}</div>
        <Text style={footer}>Der Code ist nur kurze Zeit gültig. Falls du dies nicht angefordert hast, ignoriere diese E-Mail.</Text>
        <Hr style={divider} />
        <Text style={footerText}>
          <a href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</a>
          {'  ·  '}<span>+41 79 839 50 80</span>{'  ·  '}
          <a href="https://3dmuscio.com" style={footerLink}>3dmuscio.com</a>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#18181b', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px', display: 'flex' as const, alignItems: 'center' as const, gap: '14px' }
const logoImg = { borderRadius: '8px', display: 'block' as const }
const logo = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const codeBox = { backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '24px', textAlign: 'center' as const, fontFamily: 'monospace', fontSize: '32px', fontWeight: 'bold' as const, letterSpacing: '8px', color: '#18181b', margin: '0 0 25px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 16px' }
const footerText = { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const }
const footerLink = { color: '#22c55e', textDecoration: 'none' }
