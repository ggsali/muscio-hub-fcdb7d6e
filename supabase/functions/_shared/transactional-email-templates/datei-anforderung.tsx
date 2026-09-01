/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  uploadUrl?: string
  titel?: string
  beschreibung?: string
  ablauf?: string
}

const BRAND = '#00cc66'
const LOGO = 'https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg'

const Email = ({ name, uploadUrl, titel, beschreibung, ablauf }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Datei angefordert</Preview>
    <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px' }}>
        <Section style={{ backgroundColor: '#18181b', padding: '20px 28px', borderRadius: '12px 12px 0 0' }}>
          <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ borderCollapse: 'collapse' }}>
            <tr>
              <td width={48} style={{ verticalAlign: 'middle', paddingRight: '14px' }}>
                <img src={LOGO} alt="3DMuscio" width={48} height={48} style={{ borderRadius: '8px', display: 'block' }} />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: '24px' }}>3DMuscio</div>
                <div style={{ fontSize: '12px', color: BRAND, lineHeight: '16px', fontWeight: 600 }}>3D-DRUCK SCHWEIZ</div>
              </td>
              <td align="right" style={{ verticalAlign: 'middle', fontSize: '26px' }}>📁</td>
            </tr>
          </table>
        </Section>

        <Section style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '32px 28px' }}>
          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }}>Datei angefordert</Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Guten Tag {name || 'Kunde'},
          </Text>
          <Text style={{ fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }}>
            Für die Bearbeitung Ihres Projekts benötigen wir noch Dateien von Ihnen. Über den folgenden Link können Sie diese sicher hochladen – ganz ohne Konto.
          </Text>
          {titel ? (
            <Section style={{ backgroundColor: '#ecfdf3', border: `1px solid ${BRAND}`, borderRadius: '10px', padding: '14px 18px', margin: '16px 0' }}>
              <Text style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#18181b' }}>{titel}</Text>
              {beschreibung ? <Text style={{ margin: '0 0 4px', fontSize: '13px', color: '#52525b' }}>{beschreibung}</Text> : null}
              {ablauf ? <Text style={{ margin: 0, fontSize: '12px', color: '#71717a' }}>Gültig bis: {ablauf}</Text> : null}
            </Section>
          ) : null}
          <Section style={{ margin: '28px 0 16px', textAlign: 'center' }}>
            <Link
              href={uploadUrl || 'https://3dmuscio.com'}
              style={{ backgroundColor: BRAND, color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }}
            >
              Dateien hochladen
            </Link>
          </Section>
          <Text style={{ fontSize: '12px', color: '#71717a', margin: '12px 0 0', wordBreak: 'break-all' }}>
            Oder kopieren Sie diesen Link:<br />
            <Link href={uploadUrl || 'https://3dmuscio.com'} style={{ color: BRAND, textDecoration: 'none' }}>{uploadUrl || 'https://3dmuscio.com'}</Link>
          </Text>
        </Section>

        <Section style={{ padding: '20px 8px 0', textAlign: 'center' }}>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px', textAlign: 'center' }}>3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG</Text>
          <Text style={{ fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
            <Link href="mailto:info@3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>info@3dmuscio.com</Link>
            {' · '} +41 79 839 50 80 {' · '}
            <Link href="https://3dmuscio.com" style={{ color: '#9ca3af', textDecoration: 'none' }}>3dmuscio.com</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  subject: 'Dateien für Ihr Projekt hochladen – 3DMuscio',
  displayName: 'Datei-Anforderung',
  previewData: { name: 'Max Muster', uploadUrl: 'https://3dmuscio.com/upload/abc123', titel: 'Projektdaten Halterung', beschreibung: 'Bitte laden Sie die finalen STEP-Dateien hoch.', ablauf: '30.06.2026' },
}
