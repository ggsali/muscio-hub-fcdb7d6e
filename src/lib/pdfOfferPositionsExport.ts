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

const BLACK = [30, 30, 30] as [number, number, number];
const DARK = [55, 55, 55] as [number, number, number];
const GRAY = [120, 120, 120] as [number, number, number];
const LGRAY = [200, 200, 200] as [number, number, number];
const XLGRAY = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportOfferPositionsPDF(
  props: ExportProps,
): Promise<{ base64: string; filename: string } | void> {
  const {
    orderId,
    datum,
    orderName,
    beschreibung,
    offerNote,
    positions,
    discountPercent = 0,
    company,
    customerName = "Kein Kunde",
    customerFirma,
    customerEmail,
    customerTelefon,
    customerAdresse,
    returnBase64,
  } = props;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(company.primary_color || "#FF5A00");
  const firmenname = company.firmenname || "3DMuscio";
  const offerNr = `OF-${datum?.replace(/-/g, "")}-${orderId.slice(0, 6).toUpperCase()}`;
  const gueltigBisDate = new Date(datum);
  gueltigBisDate.setDate(gueltigBisDate.getDate() + 30);
  const gueltigBis = gueltigBisDate.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" });
  const gueltigBisShort = gueltigBisDate.toISOString().split("T")[0];

  // ── Left dark header panel ────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (company.email) {
    doc.text(company.email, margin, sy);
    sy += 4.5;
  }
  if (company.telefon) {
    doc.text(company.telefon, margin, sy);
    sy += 4.5;
  }
  if (company.website) {
    doc.text(company.website, margin, sy);
  }

  // ── Right: OFFERTE title ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text("OFFERTE", pageW - margin, 26, { align: "right" });

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
  doc.text(`Datum:           ${datumFormatted}`, colR, 44);
  doc.text(`Offerten-Nr.:    ${offerNr}`, colR, 49);
  doc.text(`Gültig bis:      ${gueltigBisShort}`, colR, 54);

  // ── Customer block ─────────────────────────────────────────────────
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("ANGEBOT FÜR", margin, 76);

  const displayName = customerFirma || customerName;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text(displayName, margin, 83);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = 89;
  if (customerFirma && customerName !== "Kein Kunde") {
    doc.text(customerName, margin, cy);
    cy += 4.5;
  }
  if (customerAdresse) {
    customerAdresse.split("\n").forEach(line => {
      doc.text(line, margin, cy);
      cy += 4.5;
    });
  }
  if (customerEmail) {
    doc.text(customerEmail, margin, cy);
    cy += 4.5;
  }
  if (customerTelefon) {
    doc.text(customerTelefon, margin, cy);
  }

  // ── Right: Subject ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const subjectText = orderName ? `${orderName}${beschreibung ? " – " + beschreibung : ""}` : beschreibung || "—";
  const descLines = doc.splitTextToSize(subjectText, pageW - colR - margin) as string[];
  doc.text(descLines.slice(0, 4), colR, 83);

  // ── Positions table ───────────────────────────────────────────────
  const subtotal = positions.reduce((s, p) => s + p.menge * p.preis_pro_einheit, 0);
  const discountAmount = discountPercent > 0 ? subtotal * (discountPercent / 100) : 0;
  const finalTotal = subtotal - discountAmount;

  autoTable(doc, {
    startY: 118,
    margin: { left: margin, right: margin },
    head: [["Nr.", "Bezeichnung / Tätigkeit", "Menge", "Preis/Einheit", "Total"]],
    body: positions.map((p, i) => [
      String(i + 1).padStart(2, "0"),
      p.bezeichnung + (p.notiz ? `\n${p.notiz}` : ""),
      `${p.menge} ${p.einheit}`,
      `CHF ${p.preis_pro_einheit.toFixed(2)}`,
      `CHF ${(p.menge * p.preis_pro_einheit).toFixed(2)}`,
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      textColor: DARK,
    },
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 24, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: XLGRAY },
    tableLineColor: LGRAY,
    tableLineWidth: 0.1,
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 6;

  // ── Summary box (right side) ──────────────────────────────────────
  const sumW = 70;
  const sumX = pageW - margin - sumW;
  let sumY = afterTable;

  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(sumX, sumY, pageW - margin, sumY);
  sumY += 6;

  const sumRows: [string, string][] = [["Zwischensumme", `CHF ${subtotal.toFixed(2)}`]];
  if (discountPercent > 0) {
    sumRows.push([`Rabatt ${discountPercent}%`, `- CHF ${discountAmount.toFixed(2)}`]);
  }
  sumRows.push(["MwSt. (0%)", "CHF 0.00"]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  sumRows.forEach(([label, val]) => {
    doc.setTextColor(...GRAY);
    doc.text(label, sumX, sumY);
    doc.setTextColor(...DARK);
    doc.text(val, pageW - margin, sumY, { align: "right" });
    sumY += 6;
  });

  sumY += 2;
  doc.setFillColor(...BLACK);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("ANGEBOTSSUMME", sumX + 3, sumY + 3.5);
  doc.text(`CHF ${finalTotal.toFixed(2)}`, pageW - margin - 3, sumY + 3.5, { align: "right" });
  const totalBoxBottom = sumY + 8;

  // ── HINWEIS (below summary) ───────────────────────────────────────
  const hinweisY = totalBoxBottom + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text("HINWEIS", sumX, hinweisY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const hinweisText =
    offerNote ||
    `Dieses Angebot ist gültig bis ${gueltigBis}. Bei Annahme erstellen wir eine verbindliche Auftragsbestätigung.`;
  const hinweisLines = doc.splitTextToSize(hinweisText, pageW - sumX - margin) as string[];
  doc.text(hinweisLines, sumX, hinweisY + 6);

  // ── Vielen Dank! (left side) ──────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Wir freuen uns auf Ihre Rückmeldung.", margin, afterTable + 17);

  // ── Footer ────────────────────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, pageH - 14, pageW, 14, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 14, pageW, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  const footParts = [firmenname, company.adresse, company.email, company.website].filter(Boolean);
  doc.text(footParts.join("  |  "), margin, pageH - 5.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH")}`, pageW - margin, pageH - 5.5, { align: "right" });

  const filename = `Offerte_${offerNr}_${datum}.pdf`;
  if (returnBase64) {
    const base64 = doc.output("datauristring").split(",")[1];
    return { base64, filename };
  }
  doc.save(filename);
}
