/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '3DMuscio'
const SITE_URL = 'https://3dmuscio.com'

interface Props {
  name?: string
  completionUrl?: string
}

const Email = ({ name, completionUrl }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Bitte ergänze deine Adressdaten bei {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={header}>
          <tr>
            <td width={48} style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
              <img
                src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
                alt={SITE_NAME} width={48} height={48} style={logoImg}
              />
            </td>
            <td style={{ verticalAlign: 'middle', ...logo, lineHeight: '48px' }}>{SITE_NAME}</td>
          </tr>
        </table>

        <Heading style={h1}>
          {name ? `Hallo ${name},` : 'Hallo,'}
        </Heading>
        <Text style={text}>
          wir haben dich als Kunden bei {SITE_NAME} angelegt, uns fehlen jedoch noch deine vollständigen
          Adressdaten. Bitte ergänze sie kurz über den folgenden Link – das dauert nur eine Minute und
          ermöglicht uns die korrekte Abwicklung deiner Aufträge und Rechnungen.
        </Text>

        <Section style={{ margin: '24px 0' }}>
          <Button href={completionUrl || SITE_URL} style={button}>
            Adressdaten ergänzen
          </Button>
        </Section>

        <Text style={textSmall}>
          Oder kopiere diesen Link in deinen Browser:<br />
          <Link href={completionUrl || SITE_URL} style={link}>{completionUrl || SITE_URL}</Link>
        </Text>

        <Hr style={divider} />
        <Text style={footerText}>
          Der Link ist 30 Tage gültig. Bei Fragen melde dich jederzeit unter{' '}
          <Link href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bitte ergänze deine Adressdaten bei 3DMuscio',
  displayName: 'Profil vervollständigen (Adresse)',
  previewData: { name: 'Max Muster', completionUrl: 'https://3dmuscio.com/profil-ergaenzen?token=demo' },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#22c55e' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const textSmall: React.CSSProperties = { fontSize: '12px', lineHeight: 1.6, color: '#71717a', margin: '0 0 14px', wordBreak: 'break-all' }
const link: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
const button: React.CSSProperties = { backgroundColor: '#22c55e', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
