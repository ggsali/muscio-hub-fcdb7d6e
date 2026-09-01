/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, SITE_NAME, button, card, container, formattedName, h1,
  infoBox, link, main, smallText, text,
} from './layout.tsx'

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
        <EmailHeader emoji="📁" />
        <Section style={card}>
          <Heading style={h1}>Dateien werden benötigt</Heading>
          <Text style={text}>
            {name ? `Hallo ${formattedName(name)},` : 'Hallo,'} für die Bearbeitung deines Projekts benötigen wir noch
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
            <Link href={uploadUrl} style={link}>{uploadUrl}</Link>
          </Text>
        </Section>
        <EmailFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: ({ titel }: Record<string, any>) =>
    titel ? `📁 Dateien für "${titel}" hochladen` : '📁 Dateien für dein Projekt hochladen',
  displayName: 'Datei-Anforderung',
  previewData: {
    name: 'Max',
    uploadUrl: 'https://3dmuscio.com/upload/abc123',
    titel: 'Projektdaten Halterung',
    beschreibung: 'Bitte lade die finalen STEP-Dateien hoch.',
    ablauf: '30.06.2026',
  },
} satisfies TemplateEntry

const infoTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }
const infoText: React.CSSProperties = { fontSize: '13px', color: '#52525b', margin: '0 0 4px' }
const infoMeta: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: 0 }
