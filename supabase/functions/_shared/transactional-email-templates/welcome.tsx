/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
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
const SITE_URL = 'https://3dmuscio.com'

interface WelcomeProps {
  name?: string
  needsAddress?: boolean
}

const WelcomeEmail = ({ name, needsAddress }: WelcomeProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Willkommen bei {SITE_NAME}</Preview>
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

        <Heading style={h1}>
          {name ? `Willkommen, ${name}!` : 'Willkommen bei 3DMuscio!'}
        </Heading>
        <Text style={text}>
          Schön, dass du dabei bist. Dein Konto wurde erfolgreich erstellt – ab jetzt kannst du Anfragen senden,
          Bestellungen verfolgen und auf deine Rechnungen zugreifen.
        </Text>

        <Section style={{ margin: '24px 0' }}>
          <Button href={`${SITE_URL}/portal`} style={button}>
            Zum Kundenkonto
          </Button>
        </Section>

        {needsAddress ? (
          <>
            <Hr style={divider} />
            <Heading as="h2" style={h2}>Bitte vervollständige dein Profil</Heading>
            <Text style={text}>
              Wir benötigen noch deine Adressdaten, damit wir deine Aufträge korrekt abwickeln und Rechnungen erstellen können.
            </Text>
            <Section style={{ margin: '16px 0' }}>
              <Button href={`${SITE_URL}/portal/profil`} style={buttonSecondary}>
                Adressdaten ergänzen
              </Button>
            </Section>
          </>
        ) : null}

        <Hr style={divider} />
        <Text style={text}>
          Was du jetzt tun kannst:
        </Text>
        <Text style={listItem}>• <Link href={`${SITE_URL}/kalkulator-online`} style={link}>Preis kalkulieren und Anfrage senden</Link></Text>
        <Text style={listItem}>• <Link href={`${SITE_URL}/portal/bestellungen`} style={link}>Bestellungen verfolgen</Link></Text>
        <Text style={listItem}>• <Link href={`${SITE_URL}/portal/profil`} style={link}>Profil bearbeiten</Link></Text>

        <Hr style={divider} />
        <Text style={footerText}>
          Bei Fragen erreichst du uns unter{' '}
          <Link href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</Link>
          {' · '}
          <Link href={SITE_URL} style={footerLink}>3dmuscio.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Willkommen bei 3DMuscio',
  displayName: 'Willkommen / Konto erstellt',
  previewData: { name: 'Max Muster', needsAddress: true },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#22c55e' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
const h2: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#18181b', margin: '8px 0 12px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const listItem: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 6px' }
const link: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
const button: React.CSSProperties = { backgroundColor: '#22c55e', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const buttonSecondary: React.CSSProperties = { backgroundColor: '#18181b', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
