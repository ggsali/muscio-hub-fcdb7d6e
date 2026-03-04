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
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>E-Mail-Adresse ändern für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <span style={logo}>3DM</span>
        </div>
        <Heading style={h1}>E-Mail-Adresse ändern</Heading>
        <Text style={text}>
          Sie haben eine Änderung Ihrer E-Mail-Adresse für {siteName} beantragt, von{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          zu{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Klicken Sie auf den Button um die Änderung zu bestätigen:
        </Text>
        <Button style={button} href={confirmationUrl}>
          E-Mail-Änderung bestätigen
        </Button>
        <Text style={footerNote}>
          Falls Sie diese Änderung nicht beantragt haben, sichern Sie bitte sofort Ihr Konto.
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

export default EmailChangeEmail

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
const link = { color: '#ea580c', textDecoration: 'underline' }
const button = {
  backgroundColor: '#18181b',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footerNote = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 16px' }
const footerBlock = { textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#9ca3af', margin: '0' }
const footerLink = { color: '#ea580c', textDecoration: 'none' }
