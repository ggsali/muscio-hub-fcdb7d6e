/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, card, container, formattedName, h1, link, main, quote, text,
} from './layout.tsx'

interface Props {
  name?: string
  email?: string
  telefon?: string
  betreff?: string
  nachricht?: string
}

const Email = ({ name, email, telefon, betreff, nachricht }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Neue Anfrage von {name || 'Unbekannt'}{betreff ? ` – ${betreff}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailHeader emoji="🔔" />
        <Section style={card}>
          <Heading style={h1}>Neue Anfrage über die Website</Heading>
          <Text style={text}><strong>Name:</strong> {name ? formattedName(name) : '—'}</Text>
          <Text style={text}><strong>E-Mail:</strong> {email ? <Link href={`mailto:${email}`} style={link}>{email}</Link> : '—'}</Text>
          {telefon ? <Text style={text}><strong>Telefon:</strong> {telefon}</Text> : null}
          <Text style={text}><strong>Betreff:</strong> {betreff || '—'}</Text>
          <Text style={text}><strong>Nachricht:</strong></Text>
          <Text style={quote}>{nachricht || '—'}</Text>
          <Text style={text}>Diese Anfrage ist im Admin-Bereich unter „Anfragen" einsehbar.</Text>
        </Section>
        <EmailFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Neue Anfrage: ${data?.betreff || 'Website'}${data?.name ? ` – ${data.name}` : ''}`,
  displayName: 'Admin – Neue Anfrage',
  to: 'info@3dmuscio.com',
  previewData: {
    name: 'Max Muster',
    email: 'max@example.com',
    telefon: '+41 79 123 45 67',
    betreff: 'Angebot',
    nachricht: 'Hallo, ich hätte gerne ein Angebot...',
  },
} satisfies TemplateEntry
