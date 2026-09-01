/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Link, Section, Text } from 'npm:@react-email/components@0.0.22'

export const BRAND = '#00cc66'
export const SITE_NAME = '3DMuscio'
export const SITE_URL = 'https://3dmuscio.com'
export const LOGO_URL =
  'https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg'

/** Namen sauber kapitalisieren: "max muster" -> "Max Muster" */
export const formattedName = (name?: string | null): string =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

export const EmailHeader = ({ emoji = '📧' }: { emoji?: string }) => (
  <Section style={headerWrap}>
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ borderCollapse: 'collapse' }}>
      <tr>
        <td width={48} style={{ verticalAlign: 'middle', paddingRight: '14px' }}>
          <img src={LOGO_URL} alt={SITE_NAME} width={48} height={48} style={logoImg} />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={brandName}>{SITE_NAME}</div>
          <div style={brandClaim}>3D-Druck Schweiz</div>
        </td>
        <td align="right" style={{ verticalAlign: 'middle', fontSize: '26px' }}>
          {emoji}
        </td>
      </tr>
    </table>
  </Section>
)

export const EmailFooter = () => (
  <Section style={footerWrap}>
    <Text style={footerAddress}>3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG</Text>
    <Text style={footerText}>
      <Link href="mailto:info@3dmuscio.com" style={footerLink}>info@3dmuscio.com</Link>
      {'  ·  '}+41 79 839 50 80{'  ·  '}
      <Link href={SITE_URL} style={footerLink}>www.3dmuscio.com</Link>
    </Text>
  </Section>
)

export const main: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif',
  margin: 0,
  padding: '24px 0',
}
export const container: React.CSSProperties = { maxWidth: '600px', margin: '0 auto', padding: '0 16px' }
export const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  padding: '32px 28px',
}

const headerWrap: React.CSSProperties = {
  backgroundColor: '#18181b',
  padding: '20px 28px',
  borderRadius: '12px 12px 0 0',
}
const logoImg: React.CSSProperties = { borderRadius: '8px', display: 'block' }
const brandName: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: '24px' }
const brandClaim: React.CSSProperties = { fontSize: '12px', color: BRAND, lineHeight: '16px', fontWeight: 600 }

const footerWrap: React.CSSProperties = { padding: '20px 8px 0', textAlign: 'center' as const }
const footerAddress: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '0 0 4px', textAlign: 'center' as const }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' as const }
const footerLink: React.CSSProperties = { color: '#9ca3af', textDecoration: 'none' }

export const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 16px' }
export const h2: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#18181b', margin: '8px 0 12px' }
export const text: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#3f3f46', margin: '0 0 14px' }
export const smallText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: '12px 0 0', wordBreak: 'break-all' as const }
export const link: React.CSSProperties = { color: BRAND, textDecoration: 'none' }
export const button: React.CSSProperties = {
  backgroundColor: BRAND,
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 600,
  display: 'inline-block',
}
export const buttonSecondary: React.CSSProperties = {
  backgroundColor: '#18181b',
  color: '#ffffff',
  padding: '13px 26px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
  display: 'inline-block',
}
export const infoBox: React.CSSProperties = {
  backgroundColor: '#ecfdf3',
  border: `1px solid ${BRAND}`,
  borderRadius: '10px',
  padding: '14px 18px',
  margin: '16px 0',
}
export const quote: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.6,
  color: '#52525b',
  background: '#f4f4f5',
  borderLeft: `3px solid ${BRAND}`,
  padding: '12px 14px',
  borderRadius: '6px',
  margin: '0 0 18px',
  whiteSpace: 'pre-wrap',
}
export const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '28px 0 16px' }
