/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, SITE_NAME, SITE_URL, button, card, container,
  formattedName, h1, link, main, smallText, text,
} from './layout.tsx'

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
        <EmailHeader emoji="📋" />
        <Section style={card}>
          <Heading style={h1}>
            {name ? `Hallo ${formattedName(name)},` : 'Hallo,'}
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

          <Text style={smallText}>
            Oder kopiere diesen Link in deinen Browser:<br />
            <Link href={completionUrl || SITE_URL} style={link}>{completionUrl || SITE_URL}</Link>
          </Text>

          <Text style={smallText}>Der Link ist 30 Tage gültig.</Text>
        </Section>
        <EmailFooter />
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
