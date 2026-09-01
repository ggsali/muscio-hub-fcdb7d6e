/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  EmailFooter, EmailHeader, SITE_NAME, card, container, formattedName, h1, main, quote, text,
} from './layout.tsx'

interface ContactConfirmationProps {
  name?: string
  message?: string
}

const ContactConfirmationEmail = ({ name, message }: ContactConfirmationProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Vielen Dank für Ihre Nachricht an {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailHeader emoji="✉️" />
        <Section style={card}>
          <Heading style={h1}>
            {name ? `Vielen Dank, ${formattedName(name)}!` : 'Vielen Dank für Ihre Nachricht!'}
          </Heading>
          <Text style={text}>
            Wir haben Ihre Anfrage erhalten und melden uns so schnell wie möglich bei Ihnen zurück.
          </Text>
          {message ? (
            <>
              <Text style={text}><strong>Ihre Nachricht:</strong></Text>
              <Text style={quote}>{message}</Text>
            </>
          ) : null}
          <Text style={text}>
            Mit freundlichen Grüssen<br />
            <strong>{SITE_NAME}</strong>
          </Text>
        </Section>
        <EmailFooter />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactConfirmationEmail,
  subject: 'Vielen Dank für Ihre Nachricht – 3DMuscio',
  displayName: 'Kontaktformular-Bestätigung',
  previewData: { name: 'Max Muster', message: 'Ich hätte gerne ein Angebot für ein Custom-Print.' },
} satisfies TemplateEntry
