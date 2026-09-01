/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, SITE_NAME, SITE_URL, button, buttonSecondary, card,
  container, formattedName, h1, main, text,
} from './layout.tsx'

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
        <EmailHeader emoji="⭐" />
        <Section style={card}>
          <Heading style={h1}>Wie war dein 3D-Druck Erlebnis?</Heading>
          <Text style={text}>
            {name ? `Hallo ${formattedName(name)},` : 'Hallo,'} dein Auftrag ist abgeschlossen! Wir würden uns sehr über
            deine Bewertung freuen — sie hilft uns, besser zu werden, und anderen Kunden bei der Entscheidung.
          </Text>

          <Section style={{ margin: '28px 0 16px' }}>
            <Button href={bewertungsLink || `${SITE_URL}/bewertung`} style={button}>
              Jetzt bewerten
            </Button>
          </Section>

          <Section style={{ margin: '0 0 20px' }}>
            <Button href={GOOGLE_REVIEW_URL} style={buttonSecondary}>
              ⭐ Google Bewertung schreiben
            </Button>
          </Section>

          <Text style={text}>Jede Bewertung hilft uns sehr — vielen Dank! 🙏</Text>
        </Section>
        <EmailFooter />
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
