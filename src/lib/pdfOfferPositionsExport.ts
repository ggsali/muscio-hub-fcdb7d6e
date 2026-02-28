import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { OfferPosition } from "@/components/OfferMode";
import type { CompanySettings } from "@/lib/companySettings";

interface ExportProps {
  orderId: string;
  datum: string;
  orderName?: string;
  beschreibung?: string;
  offerNote?: string;
  positions: OfferPosition[];
  total: number;
  discountPercent: number;
  company: CompanySettings;
  customerName?: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  returnBase64?: boolean;
}

const BLACK  = [30, 30, 30]    as [number, number, number];
const DARK   = [55, 55, 55]    as [number, number, number];
const GRAY   = [120, 120, 120] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];
const XLGRAY = [245, 245, 245] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportOfferPositionsPDF(props: ExportProps): Promise<{ base64: string; filename: string } | void> {
  const {
    orderId, datum, orderName, beschreibung, offerNote,
    positions, total, discountPercent = 0, company,
    customerName = "Kein Kunde", customerFirma, customerEmail,
    customerTelefon, customerAdresse,
    returnBase64,
  } = props;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(company.primary_color || "#FF5A00");
  const firmenname = company.firmenname || "3DMuscio";
  const offerNr = `OF-${datum?.replace(/-/g, "")}-${orderId.slice(0, 6).toUpperCase()}`;

  // ── Left dark header panel ────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

  // Logo or company name
  let logoLoaded = false;
  if (company.logo_url) {
    const b64 = await loadImageAsBase64(company.logo_url);
    if (b64) {
      doc.addImage(b64, "PNG", margin, 12, 0, 18);
      logoLoaded = true;
    }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text(firmenname.toUpperCase(), margin, 24);
  }

  // Company details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (company.adresse) { doc.text(company.adresse, margin, sy); sy += 4.5; }
  if (company.email)   { doc.text(company.email,   margin, sy); sy += 4.5; }
  if (company.telefon) { doc.text(company.telefon, margin, sy); sy += 4.5; }
  if (company.website) { doc.text(company.website, margin, sy); }

  // ── Right: OFFERTE title ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text("OFFERTE", pageW - margin, 26, { align: "right" });

  // Offer details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("Offertendetails", colR, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const datumFormatted = datum
    ? new Date(datum).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const validUntil = new Date(datum);
  validUntil.setDate(validUntil.getDate() + 30);
  const validFormatted = validUntil.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" });

  doc.text(`Datum:          ${datumFormatted}`, colR, 44);
  doc.text(`Offerten-Nr.:   ${offerNr}`, colR, 49);
  doc.text(`Gültig bis:     ${validFormatted}`, colR, 54);

  // ── Customer block (light gray band) ─────────────────────────────
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  const empX = margin;
  const empY = 76;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("AN", empX, empY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  const displayName = customerFirma || customerName;
  doc.text(displayName, empX, empY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = empY + 13;
  if (customerFirma && customerName !== "Kein Kunde") { doc.text(customerName, empX, cy); cy += 4.5; }
  if (customerAdresse) { doc.text(customerAdresse, empX, cy); cy += 4.5; }
  if (customerEmail)   { doc.text(customerEmail,   empX, cy); cy += 4.5; }
  if (customerTelefon) { doc.text(customerTelefon, empX, cy); }

  // ── Right: Subject / description ─────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("BETREFF / PROJEKT", colR, 76);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const subjectText = orderName ? `${orderName}${beschreibung ? " – " + beschreibung : ""}` : (beschreibung || "—");
  const descLines = doc.splitTextToSize(subjectText, pageW - colR - margin) as string[];
  doc.text(descLines.slice(0, 4), colR, 83);

  // ── Positions table ───────────────────────────────────────────────
  const tableY = 118;

  const subtotal = positions.reduce((s, p) => s + p.menge * p.preis_pro_einheit, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const finalTotal = subtotal - discountAmount;

  const tableBody = positions.map((p, i) => [
    String(i + 1).padStart(2, "0"),
    p.bezeichnung + (p.notiz ? `\n${p.notiz}` : ""),
    `${p.menge} ${p.einheit}`,
    `CHF ${p.preis_pro_einheit.toFixed(2)}`,
    `CHF ${(p.menge * p.preis_pro_einheit).toFixed(2)}`,
  ]);

  const footRows: any[] = [];

  if (discountPercent > 0) {
    footRows.push([
      { content: `Zwischensumme`, colSpan: 4, styles: { halign: "right", textColor: GRAY, fontStyle: "normal" } },
      { content: `CHF ${subtotal.toFixed(2)}`, styles: { halign: "right", textColor: GRAY, fontStyle: "normal" } },
    ]);
    footRows.push([
      { content: `Rabatt ${discountPercent}%`, colSpan: 4, styles: { halign: "right", textColor: GRAY, fontStyle: "normal" } },
      { content: `- CHF ${discountAmount.toFixed(2)}`, styles: { halign: "right", textColor: [180, 60, 60] as [number,number,number], fontStyle: "normal" } },
    ]);
  }

  footRows.push([
    { content: "Gesamtbetrag (CHF)", colSpan: 4, styles: { halign: "right", fontStyle: "bold", fillColor: BLACK, textColor: WHITE, fontSize: 10 } },
    { content: `CHF ${finalTotal.toFixed(2)}`, styles: { halign: "right", fontStyle: "bold", fillColor: ACCENT, textColor: WHITE, fontSize: 10 } },
  ]);

  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [["Nr.", "Bezeichnung / Tätigkeit", "Menge", "Preis/Einheit", "Total"]],
    body: tableBody,
    foot: footRows,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      textColor: DARK,
    },
    headStyles: {
      fillColor: BLACK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8,
    },
    footStyles: {
      fillColor: XLGRAY,
      textColor: DARK,
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 24, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 250, 252] as [number, number, number] },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // ── Notes ─────────────────────────────────────────────────────────
  if (offerNote) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("BEMERKUNGEN / KONDITIONEN", margin, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    const noteLines = doc.splitTextToSize(offerNote, pageW - margin * 2) as string[];
    doc.text(noteLines, margin, finalY + 6);
  }

  // ── Footer bar ────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFillColor(...BLACK);
  doc.rect(0, footerY, pageW, 14, "F");

  doc.setFillColor(...ACCENT);
  doc.rect(0, footerY, 4, 14, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  const footParts = [firmenname, company.adresse, company.email].filter(Boolean);
  doc.text(footParts.join("  ·  "), margin, footerY + 9);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("Vielen Dank für Ihr Vertrauen!", pageW - margin, footerY + 9, { align: "right" });

  const filename = `Offerte_${offerNr}_${datum}.pdf`;

  if (returnBase64) {
    const base64 = doc.output("datauristring").split(",")[1];
    return { base64, filename };
  }

  doc.save(filename);
}
