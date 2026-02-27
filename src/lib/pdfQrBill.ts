/**
 * Swiss QR-Bill (Einzahlungsschein) – appended as second page to an invoice PDF.
 * Layout follows SIX Swiss Implementation Guidelines v2.3.
 *
 * Payment slip dimensions (bottom of A4):
 *   Total width: 210 mm
 *   Height:      105 mm
 *   Receipt:     62 mm wide
 *   Payment part: 148 mm wide
 *   QR code area: 46×46 mm starting at x=67 mm from left of payment part
 */

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatCHF } from "./calc";
import { CompanySettings } from "./companySettings";

// ── SIX layout constants (mm) ──────────────────────────────────────────────
const SLIP_H   = 105;
const PAGE_H   = 297; // A4
const PAGE_W   = 210;
const SLIP_Y   = PAGE_H - SLIP_H;  // top of slip on page

const RECEIPT_W  = 62;
const PAY_X      = RECEIPT_W;      // payment part starts here
const QR_X       = PAY_X + 67;     // QR code left (67 mm from payment part left = 129 mm from page left)
const QR_Y_ABS   = SLIP_Y + 17;    // QR code top absolute
const QR_SIZE    = 46;

const BLACK  = [30, 30, 30]    as [number, number, number];
const GRAY   = [120, 120, 120] as [number, number, number];
const LGRAY  = [200, 200, 200] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];

// ── QR payload builder (SIX spec) ─────────────────────────────────────────
function buildQrPayload(opts: {
  iban: string;
  creditorName: string;
  creditorAdresse: string;
  amount: number;
  currency: string;
  unstructuredMessage: string;
  billInformationRef?: string;
}): string {
  const cr = "\r\n";
  // Parse address (naive: take first line as street, rest as city)
  const addrParts = opts.creditorAdresse.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const street    = addrParts[0] || "";
  const city      = addrParts[1] || "";

  const lines = [
    "SPC",                        // QR type
    "0200",                       // version
    "1",                          // coding type UTF-8
    opts.iban.replace(/\s/g, ""),
    "K",                          // address type: combined
    opts.creditorName.slice(0, 70),
    street.slice(0, 70),
    city.slice(0, 70),
    "",                           // zip (not used for combined)
    "",                           // city (not used for combined)
    "CH",                         // country
    "", "", "", "", "", "",       // ultimate creditor (empty × 6)
    opts.amount.toFixed(2),
    opts.currency,
    "",                           // debtor address type (empty = unknown)
    "", "", "", "", "", "",       // debtor (empty × 6)
    "NON",                        // reference type: no reference
    "",                           // reference
    opts.unstructuredMessage.slice(0, 140),
    "EPD",                        // trailer
    opts.billInformationRef || "",
  ];
  return lines.join(cr);
}

// ── Render Swiss cross in QR centre ───────────────────────────────────────
function drawSwissCross(doc: jsPDF, cx: number, cy: number) {
  const w = 7, h = 7, armW = 2.4, armH = 4.5;
  // white background square
  doc.setFillColor(...WHITE);
  doc.rect(cx - w / 2, cy - h / 2, w, h, "F");
  // black cross
  doc.setFillColor(...BLACK);
  doc.rect(cx - armW / 2, cy - armH / 2, armW, armH, "F");
  doc.rect(cx - armH / 2, cy - armW / 2, armH, armW, "F");
}

// ── Scissors / perforation line ────────────────────────────────────────────
function drawPerforationLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
  // scissors icon at left
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("✂", x1 - 4, y + 1);
}

function drawVerticalPerf(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(x, y1, x, y2);
  doc.setLineDashPattern([], 0);
}

// ── Label + text helper ────────────────────────────────────────────────────
function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...BLACK);
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: jsPDF, text: string, x: number, y: number, maxW?: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  if (maxW) {
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return lines.length;
  }
  doc.text(text, x, y);
  return 1;
}

// ── Main export ────────────────────────────────────────────────────────────
export async function appendQrBill(
  doc: jsPDF,
  opts: {
    company: CompanySettings;
    customerName: string;
    customerAdresse?: string;
    amount: number;
    currency?: string;
    invoiceNr: string;
  }
) {
  const currency = opts.currency || "CHF";
  const iban     = (opts.company.bank_iban || "").replace(/\s/g, "");

  // Only render if IBAN is set – otherwise skip silently
  if (!iban) return;

  doc.addPage();

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const slipY = pageH - SLIP_H;

  // ── Perforation lines ──────────────────────────────────────────────────
  drawPerforationLine(doc, 5, slipY, pageW - 5);
  drawVerticalPerf(doc, RECEIPT_W, slipY, pageH);

  // ── QR Code ────────────────────────────────────────────────────────────
  const qrPayload = buildQrPayload({
    iban,
    creditorName:    opts.company.bank_inhaber || opts.company.firmenname || "3dMuscio",
    creditorAdresse: opts.company.adresse || "",
    amount:          opts.amount,
    currency,
    unstructuredMessage: `Rechnung ${opts.invoiceNr}`,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 400,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const qrAbsY = slipY + 17;
  doc.addImage(qrDataUrl, "PNG", QR_X, qrAbsY, QR_SIZE, QR_SIZE);

  // Swiss cross centred on QR
  drawSwissCross(doc, QR_X + QR_SIZE / 2, qrAbsY + QR_SIZE / 2);

  // ── ── RECEIPT (left column, 62 mm wide) ── ──────────────────────────
  const RX = 5; // receipt left margin
  let ry = slipY + 8;

  label(doc, "Empfangsschein", RX, ry); ry += 5;

  label(doc, "Konto / Zahlbar an", RX, ry); ry += 3.5;
  const ibanFormatted = iban.replace(/(.{4})/g, "$1 ").trim();
  value(doc, ibanFormatted, RX, ry); ry += 4;
  const credName = opts.company.bank_inhaber || opts.company.firmenname || "";
  const linesName = value(doc, credName, RX, ry, RECEIPT_W - 10); ry += linesName * 3.5;
  if (opts.company.adresse) {
    const linesAddr = value(doc, opts.company.adresse, RX, ry, RECEIPT_W - 10);
    ry += linesAddr * 3.5;
  }
  ry += 3;

  label(doc, "Referenz", RX, ry); ry += 3.5;
  value(doc, `Rechnung ${opts.invoiceNr}`, RX, ry); ry += 6;

  label(doc, "Zahlbar durch", RX, ry); ry += 3.5;
  const linesDebtor = value(doc, opts.customerName, RX, ry, RECEIPT_W - 10); ry += linesDebtor * 3.5;
  if (opts.customerAdresse) {
    value(doc, opts.customerAdresse, RX, ry, RECEIPT_W - 10);
  }

  // Amount in receipt (bottom left)
  const amtY = slipY + SLIP_H - 18;
  label(doc, "Währung", RX, amtY);
  label(doc, "Betrag", RX + 16, amtY);
  value(doc, currency, RX, amtY + 4);
  value(doc, formatCHF(opts.amount).replace("CHF ", ""), RX + 16, amtY + 4);

  // "Annahmestelle" bottom-right of receipt
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...BLACK);
  doc.text("Annahmestelle", RECEIPT_W - 5, pageH - 5, { align: "right" });

  // ── PAYMENT PART (right of receipt, 148 mm wide) ─────────────────────
  const PX = PAY_X + 5; // inner left of payment part

  let py = slipY + 8;
  label(doc, "Zahlteil", PX, py); py += 5;

  // Currency & amount (below QR)
  const belowQR = qrAbsY + QR_SIZE + 6;
  label(doc, "Währung", PX, belowQR);
  label(doc, "Betrag", PX + 16, belowQR);
  value(doc, currency, PX, belowQR + 4);
  value(doc, formatCHF(opts.amount).replace("CHF ", ""), PX + 16, belowQR + 4);

  // Right column of payment part (account, reference, debtor)
  const RCX = QR_X + QR_SIZE + 5;
  let rcy = slipY + 10;

  label(doc, "Konto / Zahlbar an", RCX, rcy); rcy += 3.5;
  value(doc, ibanFormatted, RCX, rcy); rcy += 4;
  const ln1 = value(doc, credName, RCX, rcy, pageW - RCX - 5); rcy += ln1 * 3.5;
  if (opts.company.adresse) {
    const ln2 = value(doc, opts.company.adresse, RCX, rcy, pageW - RCX - 5);
    rcy += ln2 * 3.5;
  }
  rcy += 3;

  label(doc, "Referenz", RCX, rcy); rcy += 3.5;
  value(doc, `Rechnung ${opts.invoiceNr}`, RCX, rcy); rcy += 6;

  label(doc, "Zusätzliche Informationen", RCX, rcy); rcy += 3.5;
  if (opts.company.zahlungsbedingungen) {
    const info = doc.splitTextToSize(opts.company.zahlungsbedingungen, pageW - RCX - 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...BLACK);
    doc.text(info.slice(0, 3), RCX, rcy);
    rcy += info.slice(0, 3).length * 3 + 4;
  }

  label(doc, "Zahlbar durch", RCX, rcy); rcy += 3.5;
  const ld1 = value(doc, opts.customerName, RCX, rcy, pageW - RCX - 5); rcy += ld1 * 3.5;
  if (opts.customerAdresse) {
    value(doc, opts.customerAdresse, RCX, rcy, pageW - RCX - 5);
  }

  // "Weitere Informationen" placeholder box (bottom right)
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.rect(RCX, pageH - 20, pageW - RCX - 5, 12, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text("Weitere Informationen", RCX + 1, pageH - 13);
}
