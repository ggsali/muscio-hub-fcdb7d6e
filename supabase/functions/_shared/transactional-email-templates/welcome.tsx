/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, SITE_NAME, SITE_URL, button, buttonSecondary, card,
  container, divider, formattedName, h1, h2, link, main, text,
} from './layout.tsx'

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
        <EmailHeader emoji="👋" />
        <Section style={card}>
          <Heading style={h1}>
            {name ? `Willkommen, ${formattedName(name)}!` : 'Willkommen bei 3DMuscio!'}
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
          <Text style={text}>Was du jetzt tun kannst:</Text>
          <Text style={listItem}>• <Link href={`${SITE_URL}/kalkulator-online`} style={link}>Preis kalkulieren und Anfrage senden</Link></Text>
          <Text style={listItem}>• <Link href={`${SITE_URL}/portal/bestellungen`} style={link}>Bestellungen verfolgen</Link></Text>
          <Text style={listItem}>• <Link href={`${SITE_URL}/portal/profil`} style={link}>Profil bearbeiten</Link></Text>
        </Section>
        <EmailFooter />
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

const listItem: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 6px' }
