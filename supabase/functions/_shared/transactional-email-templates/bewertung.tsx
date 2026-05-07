/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '3DMuscio'
const SITE_URL = 'https://3dmuscio.com'
const GOOGLE_REVIEW_URL = 'https://g.page/r/CZWZrGWQTJ_OEAE/review'

interface BewertungProps {
  name?: string
  bewertungsLink?: string
}

const BewertungEmail = ({ name, bewertungsLink }: BewertungProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Wie war dein 3D-Druck Erlebnis bei {SITE_NAME}?</Preview>
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

        <Heading style={h1}>Wie war dein 3D-Druck Erlebnis? ⭐</Heading>
        <Text style={text}>
          {name ? `Hallo ${name},` : 'Hallo,'} dein Auftrag ist abgeschlossen! Wir würden uns sehr über
          deine Bewertung freuen — sie hilft uns, besser zu werden, und anderen Kunden bei der Entscheidung.
        </Text>

        <Section style={{ margin: '28px 0 16px' }}>
          <Button href={bewertungsLink || `${SITE_URL}/bewertung`} style={button}>
            Jetzt bewerten
          </Button>
        </Section>

        <Section style={{ margin: '0 0 20px' }}>
          <Button href={GOOGLE_REVIEW_URL} style={buttonOutline}>
            ⭐ Google Bewertung schreiben
          </Button>
        </Section>

        <Text style={smallText}>Jede Bewertung hilft uns sehr — vielen Dank! 🙏</Text>

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
  component: BewertungEmail,
  subject: 'Wie war dein 3D-Druck Erlebnis? ⭐',
  displayName: 'Bewertungsanfrage',
  previewData: { name: 'Max', bewertungsLink: 'https://3dmuscio.com/bewertung/abc123' },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header: React.CSSProperties = { borderCollapse: 'separate', marginBottom: '24px' }
const logoImg: React.CSSProperties = { borderRadius: '8px' }
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#22c55e' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
const smallText: React.CSSProperties = { fontSize: '13px', color: '#71717a', margin: '8px 0 0', textAlign: 'center' as const }
const button: React.CSSProperties = { backgroundColor: '#22c55e', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }
const buttonOutline: React.CSSProperties = { backgroundColor: '#ffffff', color: '#18181b', border: '2px solid #18181b', padding: '12px 26px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
const footerLink: React.CSSProperties = { color: '#22c55e', textDecoration: 'none' }
