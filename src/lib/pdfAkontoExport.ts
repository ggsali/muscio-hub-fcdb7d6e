import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, Settings } from "./calc";
import { CompanySettings } from "./companySettings";
import { appendQrBill } from "./pdfQrBill";

interface PartRow {
  teilname: string;
  material: string;
  menge: number;
  preis_pro_stueck: number;
  preis_total: number;
}

export interface AkontoExportData {
  orderId: string;
  datum: string;
  beschreibung: string;
  status: string;
  customerName: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  parts: PartRow[];
  umsatz_total: number;
  akontoPercent: number;
  akontoBetrag: number;
  settings: Settings;
  company: CompanySettings;
  returnBase64?: boolean;
  expressKosten?: number;
  expressLabel?: string;
}

export interface RestbetragExportData extends Omit<AkontoExportData, 'akontoPercent' | 'akontoBetrag'> {
  akontoPercent: number;
  akontoBetrag: number;
  restbetrag: number;
}

// ─── Shared design tokens ────────────────────────────────────────────────────
const BLACK  = [30, 30, 30]   as [number, number, number];
const DARK   = [55, 55, 55]   as [number, number, number];
const GRAY   = [120, 120, 120] as [number, number, number];
const LGRAY  = [200, 200, 200] as [number, number, number];
const XLGRAY = [245, 245, 245] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];

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

/** Gemeinsamer Header-Block (Logo/Firmenname links, Kontakt, Titel rechts oben) */
async function drawHeader(
  doc: jsPDF,
  company: CompanySettings,
  titleLines: string[],
  pageW: number,
  margin: number,
) {
  const BLACK_: [number, number, number] = [30, 30, 30];
  const WHITE_: [number, number, number] = [255, 255, 255];

  doc.setFillColor(...BLACK_);
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
    doc.setTextColor(...WHITE_);
    doc.text((company.firmenname || "3DMuscio").toUpperCase(), margin, 24);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (company.email)   { doc.text(company.email,   margin, sy); sy += 4.5; }
  if (company.telefon) { doc.text(company.telefon, margin, sy); sy += 4.5; }
  if (company.website) { doc.text(company.website, margin, sy); }

  // Titel zentriert in der rechten Spalte
  // Rechte Spalte: von (pageW/2 + 4) bis pageW — Mitte davon
  const rightColStart = pageW / 2 + 4;
  const rightColEnd = pageW;
  const rightColCenter = (rightColStart + rightColEnd) / 2;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK_);

  if (titleLines.length === 1) {
    // Schriftgrösse automatisch anpassen: max 30, kleiner wenn zu lang
    const maxWidth = rightColEnd - rightColStart - 8;
    let fontSize = 30;
    doc.setFontSize(fontSize);
    while (doc.getTextWidth(titleLines[0]) > maxWidth && fontSize > 14) {
      fontSize -= 1;
      doc.setFontSize(fontSize);
    }
    doc.text(titleLines[0], rightColCenter, 26, { align: "center" });
  } else {
    doc.setFontSize(22);
    let ty = 22;
    titleLines.forEach(line => {
      doc.text(line, rightColCenter, ty, { align: "center" });
      ty += 10;
    });
  }
}

/** Gemeinsamer Empfänger-Block */
function drawRecipient(
  doc: jsPDF,
  data: { customerName: string; customerFirma?: string; customerAdresse?: string; customerEmail?: string; customerTelefon?: string },
  label: string,
  margin: number,
  pageW: number,
) {
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(label, margin, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text(data.customerName, margin, 83);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = 89;
  if (data.customerFirma)   { data.customerFirma.split("\n").forEach(l => { doc.text(l, margin, cy); cy += 4.5; }); }
  if (data.customerAdresse) { data.customerAdresse.split("\n").forEach(l => { doc.text(l, margin, cy); cy += 4.5; }); }
  if (data.customerEmail)   { doc.text(data.customerEmail,   margin, cy); cy += 4.5; }
  if (data.customerTelefon) { doc.text(data.customerTelefon, margin, cy); }
}

/** Gemeinsamer Footer */
function drawFooter(doc: jsPDF, company: CompanySettings, ACCENT: [number, number, number], pageW: number, pageH: number, margin: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, pageH - 14, pageW, 14, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  const footParts = [company.firmenname || "3DMuscio", company.adresse, company.email, company.website].filter(Boolean);
  doc.text(footParts.join("  |  "), margin, pageH - 5.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}`, pageW - margin, pageH - 5.5, { align: "right" });
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 14, pageW, 2, "F");
}

/** Gemeinsame Positionen-Tabelle */
function drawPartsTable(doc: jsPDF, parts: PartRow[], margin: number, expressKosten?: number, expressLabel?: string) {
  const body: any[][] = parts.map((p, i) => [
    String(i + 1).padStart(2, "0"),
    p.teilname || "—",
    p.material,
    `${p.menge}×`,
    formatCHF(p.preis_pro_stueck),
    formatCHF(p.preis_total),
  ]);
  if ((expressKosten ?? 0) > 0) {
    body.push([
      String(body.length + 1).padStart(2, "0"),
      expressLabel?.trim() || "Express-Lieferung",
      "—",
      "1×",
      formatCHF(expressKosten!),
      formatCHF(expressKosten!),
    ]);
  }
  autoTable(doc, {
    startY: 118,
    margin: { left: margin, right: margin },
    head: [["Nr.", "Beschreibung", "Material", "Menge", "Preis/St.", "Total"]],
    body,
    styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }, textColor: DARK },
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 12, halign: "center" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: XLGRAY },
    tableLineColor: LGRAY,
    tableLineWidth: 0.1,
  });
}

/** "Vielen Dank" links + optional UID */
function drawThanks(doc: jsPDF, afterTable: number, margin: number, uid?: string | null, text = "Wir schätzen Ihr Vertrauen.") {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(text, margin, afterTable + 16);
  if (uid) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`UID: ${uid}`, margin, afterTable + 22);
  }
}

/** Trennlinie + Zwischensumme-Zeilen */
function drawSumRows(doc: jsPDF, rows: [string, string][], sumX: number, pageW: number, margin: number, startY: number): number {
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(sumX, startY, pageW - margin, startY);
  let sumY = startY + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rows.forEach(([label, val]) => {
    doc.setTextColor(...GRAY);
    doc.text(label, sumX, sumY);
    doc.setTextColor(...DARK);
    doc.text(val, pageW - margin, sumY, { align: "right" });
    sumY += 6;
  });
  return sumY;
}

/** Zahlungsbedingungen/Hinweis-Block */
function drawTerms(doc: jsPDF, title: string, text: string, sumX: number, termsY: number, pageW: number, margin: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text(title, sumX, termsY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const lines = doc.splitTextToSize(text, pageW - sumX - margin);
  doc.text(lines, sumX, termsY + 6);
}

// ─── Akontorechnung ──────────────────────────────────────────────────────────
export async function exportAkontoPDF(data: AkontoExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const firmenname = data.company.firmenname || "3DMuscio";

  const datumClean = data.datum ? new Date(data.datum + "T12:00:00").toISOString().split("T")[0].replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
  const akontoNr = `AK-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;
  const rechnungsNr = `RE-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;

  await drawHeader(doc, data.company, ["AKONTORECHNUNG"], pageW, margin);

  // Details rechts
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text("Rechnungsdetails", colR, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const datumFormatted = data.datum ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  doc.text(`Datum:               ${datumFormatted}`, colR, 44);
  doc.text(`Akontorechn.-Nr.:    ${akontoNr}`, colR, 49);
  doc.text(`Basis-Rechnungs-Nr.: ${rechnungsNr}`, colR, 54);
  doc.text(`Akontozahlung:       ${data.akontoPercent}% von Gesamtbetrag`, colR, 59);

  drawRecipient(doc, data, "RECHNUNGSEMPFÄNGER", margin, pageW);

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const rawDesc = data.beschreibung || "—";
  const descLines = rawDesc.split("\n").flatMap(line => doc.splitTextToSize(line || " ", pageW - colR - margin));
  doc.text(descLines.slice(0, 5), colR, 83);

  drawPartsTable(doc, data.parts, margin, data.expressKosten, data.expressLabel);

  const afterTable = (doc as any).lastAutoTable.finalY + 6;
  const sumW = 70;
  const sumX = pageW - margin - sumW;

  const partsSubtotal = data.umsatz_total - (data.expressKosten ?? 0);
  const sumRows: [string, string][] = [
    ["Teile/Leistungen", formatCHF(partsSubtotal)],
  ];
  if ((data.expressKosten ?? 0) > 0) {
    sumRows.push([data.expressLabel?.trim() || "Express-Lieferung", formatCHF(data.expressKosten!)]);
  }
  sumRows.push(["Gesamtbetrag (Referenz)", formatCHF(data.umsatz_total)]);
  sumRows.push([`Akontozahlung (${data.akontoPercent}%)`, formatCHF(data.akontoBetrag)]);
  sumRows.push(["MwSt. (0%)", "CHF 0.00"]);
  let sumY = drawSumRows(doc, sumRows, sumX, pageW, margin, afterTable);

  sumY += 2;
  doc.setFillColor(...ACCENT);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...WHITE);
  doc.text(`AKONTOZAHLUNG ${data.akontoPercent}%`, sumX + 3, sumY + 3.5);
  doc.text(formatCHF(data.akontoBetrag), pageW - margin - 3, sumY + 3.5, { align: "right" });

  const totalBoxBottom = sumY + 8;

  drawTerms(doc, "ZAHLUNGSBEDINGUNGEN",
    data.company.zahlungsbedingungen || "Zahlung fällig innerhalb von 30 Tagen nach Rechnungsdatum. Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
    sumX, totalBoxBottom + 8, pageW, margin);

  drawThanks(doc, afterTable, margin, data.company.uid_nummer);
  drawFooter(doc, data.company, ACCENT, pageW, pageH, margin);

  const safeName = data.customerName.replace(/[äöüÄÖÜß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" }[c] || c)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Akontorechnung_${akontoNr}_${safeName}.pdf`;

  if (data.company.qr_bill_image_url) {
    const qrImg = await loadImageAsBase64(data.company.qr_bill_image_url);
    if (qrImg) { doc.addPage(); const pw = doc.internal.pageSize.getWidth(); const ph = doc.internal.pageSize.getHeight(); doc.addImage(qrImg, "PNG", 0, 0, pw, ph); }
  } else {
    await appendQrBill(doc, { company: data.company, customerName: data.customerName, customerAdresse: data.customerAdresse, amount: data.akontoBetrag, invoiceNr: akontoNr });
  }

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
}

// ─── Schlussrechnung (Restbetrag) ────────────────────────────────────────────
export async function exportRestbetragPDF(data: RestbetragExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");

  const datumClean = data.datum ? new Date(data.datum + "T12:00:00").toISOString().split("T")[0].replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
  const restNr  = `RS-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;
  const akontoNr = `AK-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;

  await drawHeader(doc, data.company, ["SCHLUSSRECHNUNG"], pageW, margin);

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text("Rechnungsdetails", colR, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const datumFormatted = data.datum ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  doc.text(`Datum:               ${datumFormatted}`, colR, 44);
  doc.text(`Schlussrechn.-Nr.:   ${restNr}`, colR, 49);
  doc.text(`Akonto-Ref.:         ${akontoNr}`, colR, 54);
  doc.text(`Bereits bezahlt:     ${data.akontoPercent}% (${formatCHF(data.akontoBetrag)})`, colR, 59);

  drawRecipient(doc, data, "RECHNUNGSEMPFÄNGER", margin, pageW);

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const rawDesc2 = data.beschreibung || "—";
  const descLines = rawDesc2.split("\n").flatMap(line => doc.splitTextToSize(line || " ", pageW - colR - margin));
  doc.text(descLines.slice(0, 5), colR, 83);

  drawPartsTable(doc, data.parts, margin);

  const afterTable = (doc as any).lastAutoTable.finalY + 6;
  const sumW = 70;
  const sumX = pageW - margin - sumW;

  const sumRows: [string, string][] = [
    ["Gesamtbetrag", formatCHF(data.umsatz_total)],
    [`Abzüglich Akonto (${data.akontoPercent}%)`, `- ${formatCHF(data.akontoBetrag)}`],
    ["MwSt. (0%)", "CHF 0.00"],
  ];
  let sumY = drawSumRows(doc, sumRows, sumX, pageW, margin, afterTable);

  sumY += 2;
  doc.setFillColor(...ACCENT);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...WHITE);
  doc.text("RESTBETRAG", sumX + 3, sumY + 3.5);
  doc.text(formatCHF(data.restbetrag), pageW - margin - 3, sumY + 3.5, { align: "right" });

  const totalBoxBottom = sumY + 8;

  drawTerms(doc, "ZAHLUNGSBEDINGUNGEN",
    data.company.zahlungsbedingungen || "Zahlung fällig innerhalb von 30 Tagen nach Rechnungsdatum. Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
    sumX, totalBoxBottom + 8, pageW, margin);

  drawThanks(doc, afterTable, margin, data.company.uid_nummer);
  drawFooter(doc, data.company, ACCENT, pageW, pageH, margin);

  const safeName = data.customerName.replace(/[äöüÄÖÜß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" }[c] || c)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Schlussrechnung_${restNr}_${safeName}.pdf`;

  if (data.company.qr_bill_image_url) {
    const qrImg = await loadImageAsBase64(data.company.qr_bill_image_url);
    if (qrImg) { doc.addPage(); const pw = doc.internal.pageSize.getWidth(); const ph = doc.internal.pageSize.getHeight(); doc.addImage(qrImg, "PNG", 0, 0, pw, ph); }
  } else {
    await appendQrBill(doc, { company: data.company, customerName: data.customerName, customerAdresse: data.customerAdresse, amount: data.restbetrag, invoiceNr: restNr });
  }

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
}
