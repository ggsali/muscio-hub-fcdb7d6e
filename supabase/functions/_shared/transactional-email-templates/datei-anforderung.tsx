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
  uploadUrl: string
  titel?: string
  beschreibung?: string
  ablauf?: string
}

const Email = ({ name, uploadUrl, titel, beschreibung, ablauf }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Dateien hochladen für {SITE_NAME}</Preview>
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

        <Heading style={h1}>📎 Dateien werden benötigt</Heading>
        <Text style={text}>
          {name ? `Hallo ${name},` : 'Hallo,'} für die Bearbeitung deines Projekts benötigen wir noch
          ein paar Dateien von dir. Über den folgenden Link kannst du diese sicher hochladen — ganz
          ohne Konto.
        </Text>

        {titel && (
          <Section style={infoBox}>
            <Text style={infoTitle}>{titel}</Text>
            {beschreibung && <Text style={infoText}>{beschreibung}</Text>}
            {ablauf && <Text style={infoMeta}>Gültig bis: {ablauf}</Text>}
          </Section>
        )}

        <Section style={{ margin: '28px 0 16px', textAlign: 'center' as const }}>
          <Button href={uploadUrl} style={button}>
            Dateien hochladen
          </Button>
        </Section>

        <Text style={smallText}>
          Oder kopiere diesen Link in deinen Browser:<br />
          <Link href={uploadUrl} style={footerLink}>{uploadUrl}</Link>
        </Text>

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
  component: Email,
  subject: ({ titel }: Record<string, any>) =>
    titel ? `📎 Dateien für "${titel}" hochladen` : '📎 Dateien für dein Projekt hochladen',
  displayName: 'Datei-Anforderung',
  previewData: {
    name: 'Max',
    uploadUrl: 'https://3dmuscio.com/upload/abc123',
    titel: 'Projektdaten Halterung',
    beschreibung: 'Bitte lade die finalen STEP-Dateien hoch.',
    ablauf: '30.06.2026',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#FF5A00' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const smallText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: '12px 0 0', textAlign: 'center' as const, wordBreak: 'break-all' as const }
const button: React.CSSProperties = { backgroundColor: '#FF5A00', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }
const infoBox: React.CSSProperties = { backgroundColor: '#fafafa', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const infoTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }
const infoText: React.CSSProperties = { fontSize: '13px', color: '#52525b', margin: '0 0 4px' }
const infoMeta: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#FF5A00', textDecoration: 'none' }
