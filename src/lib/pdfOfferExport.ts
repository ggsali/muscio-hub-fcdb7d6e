import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, Settings } from "./calc";
import { CompanySettings } from "./companySettings";
import { checkPdfPlausibility } from "./pdfPlausibility";

interface PartRow {
  teilname: string;
  material: string;
  menge: number;
  gewicht_g?: number;
  druckzeit_h?: number;
  nachbearbeitung_h?: number;
  konstruktion_h?: number;
  preis_pro_stueck: number;
  preis_total: number;
  filament_einkauf_pro_kg?: number | null;
  filament_verkauf_pro_g?: number | null;
}

const MATERIAL_AUFSCHLAG = 3.0;

function effectiveMaterialPricePerG(p: PartRow, fallback: number): number {
  if (p.filament_verkauf_pro_g != null) return Number(p.filament_verkauf_pro_g);
  if (p.filament_einkauf_pro_kg != null) return (Number(p.filament_einkauf_pro_kg) / 1000) * MATERIAL_AUFSCHLAG;
  return fallback;
}

interface OfferExportData {
  orderId: string;
  datum: string;
  beschreibung: string;
  customerName: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  parts: PartRow[];
  umsatz_total: number;
  settings: Settings;
  company: CompanySettings;
  gueltigBis?: string;
  returnBase64?: boolean;
  withDetails?: boolean;
  expressKosten?: number;
  expressLabel?: string;
  rabattProzent?: number;
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

/** Gemeinsamer Header-Bereich: linke dunkle Spalte + Firmeninfos */
async function drawHeader(doc: jsPDF, company: CompanySettings, pageW: number, margin: number): Promise<boolean> {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

  let logoLoaded = false;
  if (company.logo_url) {
    const b64 = await loadImageAsBase64(company.logo_url);
    if (b64) { doc.addImage(b64, "PNG", margin, 12, 0, 18); logoLoaded = true; }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...WHITE);
    doc.text((company.firmenname || "3DMuscio").toUpperCase(), margin, 24);
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (company.email)   { doc.text(company.email,   margin, sy); sy += 4.5; }
  if (company.telefon) { doc.text(company.telefon, margin, sy); sy += 4.5; }
  if (company.website) { doc.text(company.website, margin, sy); }
  return logoLoaded;
}

/** Gemeinsamer Empfänger-Block */
function drawRecipient(
  doc: jsPDF,
  data: { customerName: string; customerFirma?: string; customerAdresse?: string; customerEmail?: string; customerTelefon?: string },
  label: string, margin: number, pageW: number,
) {
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text(label, margin, 76);

  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...BLACK);
  doc.text(data.customerName, margin, 83);

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  let cy = 89;
  if (data.customerFirma)   { doc.text(data.customerFirma, margin, cy); cy += 4.5; }
  if (data.customerAdresse) { data.customerAdresse.split("\n").forEach(l => { doc.text(l, margin, cy); cy += 4.5; }); }
  if (data.customerEmail)   { doc.text(data.customerEmail, margin, cy); cy += 4.5; }
  if (data.customerTelefon) { doc.text(data.customerTelefon, margin, cy); }
}

/** Gemeinsamer Footer */
function drawFooter(doc: jsPDF, company: CompanySettings, ACCENT: [number, number, number], pageW: number, pageH: number, margin: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, pageH - 14, pageW, 14, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
  const footParts = [company.firmenname || "3DMuscio", company.adresse, company.email, company.website].filter(Boolean);
  doc.text(footParts.join("  |  "), margin, pageH - 5.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}`, pageW - margin, pageH - 5.5, { align: "right" });
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 14, pageW, 2, "F");
}

/** Gemeinsame Summary-Zeilen + Total-Box */
function drawSummary(
  doc: jsPDF,
  sumRows: [string, string][],
  totalLabel: string,
  totalValue: string,
  ACCENT: [number, number, number],
  sumX: number, afterTable: number, pageW: number, margin: number,
): number {
  const sumW = 70;
  let sumY = afterTable;

  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.line(sumX, sumY, pageW - margin, sumY);
  sumY += 6;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  sumRows.forEach(([label, val]) => {
    doc.setTextColor(...GRAY); doc.text(label, sumX, sumY);
    doc.setTextColor(...DARK); doc.text(val, pageW - margin, sumY, { align: "right" });
    sumY += 6;
  });

  sumY += 2;
  doc.setFillColor(...ACCENT);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...WHITE);
  doc.text(totalLabel, sumX + 3, sumY + 3.5);
  doc.text(totalValue, pageW - margin - 3, sumY + 3.5, { align: "right" });

  return sumY + 8; // totalBoxBottom
}

// ─── Offerte (Standard + Details) ───────────────────────────────────────────
export async function exportOfferPDF(data: OfferExportData) {
  checkPdfPlausibility({
    parts: data.parts,
    expressKosten: data.expressKosten,
    umsatz_total: data.umsatz_total,
    context: "Offerte",
  });
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");

  const datumClean = data.datum ? new Date(data.datum + "T12:00:00").toISOString().split("T")[0].replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
  const offerNr = `OF-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;
  const gueltigBis = data.gueltigBis || (() => {
    const d = new Date(data.datum); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  })();

  await drawHeader(doc, data.company, pageW, margin);

  // Titel
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...BLACK);
  doc.text("OFFERTE", pageW - margin, 26, { align: "right" });

  // Details rechts
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text("Offertendetails", colR, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const datumFormatted = data.datum ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  doc.text(`Datum:           ${datumFormatted}`, colR, 44);
  doc.text(`Offerten-Nr.:    ${offerNr}`, colR, 49);
  doc.text(`Gültig bis:      ${gueltigBis}`, colR, 54);

  drawRecipient(doc, data, "ANGEBOT FÜR", margin, pageW);

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const rawDesc = data.beschreibung || "—";
  const descLines = rawDesc.split("\n").flatMap(line => doc.splitTextToSize(line || " ", pageW - colR - margin));
  doc.text(descLines.slice(0, 5), colR, 83);

  // ── Positionstabelle ────────────────────────────────────────────
  if (data.withDetails) {
    const detailBody: any[][] = [];
    const s = data.settings;
    data.parts.forEach((p, i) => {
      const nr = String(i + 1).padStart(2, "0");
      const rowBg = i % 2 === 0 ? WHITE : XLGRAY;
      detailBody.push([
        { content: nr, styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, fontSize: 8.5 } },
        { content: p.teilname || "—", styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, fontSize: 8.5 } },
        { content: `${p.menge}×`, styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, halign: "center", fontSize: 8.5 } },
        { content: formatCHF(p.preis_pro_stueck), styles: { fillColor: BLACK, textColor: WHITE, halign: "right", fontSize: 8.5 } },
        { content: formatCHF(p.preis_total), styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, halign: "right", fontSize: 8.5 } },
      ]);
      if (s.setup_pauschale > 0) {
        detailBody.push([
          { content: "", styles: { fillColor: rowBg } },
          { content: "Setup-Pauschale", styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", fillColor: rowBg } },
          { content: `1×`, styles: { fontSize: 8.5, textColor: GRAY, halign: "center", fillColor: rowBg } },
          { content: formatCHF(s.setup_pauschale), styles: { fontSize: 8.5, textColor: GRAY, halign: "right", fillColor: rowBg } },
          { content: formatCHF(s.setup_pauschale), styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", halign: "right", fillColor: rowBg } },

        ]);
      }
      if ((p.gewicht_g ?? 0) > 0) {
        const matRate = effectiveMaterialPricePerG(p, s.material_verkauf_pro_g);
        const matTotal = (p.gewicht_g ?? 0) * matRate * p.menge;
        detailBody.push([
          { content: "", styles: { fillColor: rowBg } },
          { content: `Material (${p.material})`, styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", fillColor: rowBg } },
          { content: `${p.gewicht_g}g`, styles: { fontSize: 8.5, textColor: GRAY, halign: "center", fillColor: rowBg } },
          { content: `${formatCHF(matRate)}/g`, styles: { fontSize: 8.5, textColor: GRAY, halign: "right", fillColor: rowBg } },
          { content: formatCHF(matTotal), styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", halign: "right", fillColor: rowBg } },
        ]);
      }
      if ((p.druckzeit_h ?? 0) > 0) {
        const druckTotal = (p.druckzeit_h ?? 0) * s.maschinenzeit_pro_h * p.menge;
        detailBody.push([
          { content: "", styles: { fillColor: rowBg } },
          { content: "Druckzeit (Maschinenzeit)", styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", fillColor: rowBg } },
          { content: `${(p.druckzeit_h ?? 0).toFixed(1)}h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "center", fillColor: rowBg } },
          { content: `${formatCHF(s.maschinenzeit_pro_h)}/h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "right", fillColor: rowBg } },
          { content: formatCHF(druckTotal), styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", halign: "right", fillColor: rowBg } },
        ]);
      }
      if ((p.konstruktion_h ?? 0) > 0) {
        const konstrTotal = (p.konstruktion_h ?? 0) * s.konstruktion_pro_h * p.menge;
        detailBody.push([
          { content: "", styles: { fillColor: rowBg } },
          { content: "Konstruktion / Engineering", styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", fillColor: rowBg } },
          { content: `${(p.konstruktion_h ?? 0).toFixed(1)}h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "center", fillColor: rowBg } },
          { content: `${formatCHF(s.konstruktion_pro_h)}/h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "right", fillColor: rowBg } },
          { content: formatCHF(konstrTotal), styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", halign: "right", fillColor: rowBg } },
        ]);
      }
      if ((p.nachbearbeitung_h ?? 0) > 0) {
        const nbTotal = (p.nachbearbeitung_h ?? 0) * s.nachbearbeitung_pro_h * p.menge;
        detailBody.push([
          { content: "", styles: { fillColor: rowBg } },
          { content: "Nachbearbeitung / Finishing", styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", fillColor: rowBg } },
          { content: `${(p.nachbearbeitung_h ?? 0).toFixed(1)}h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "center", fillColor: rowBg } },
          { content: `${formatCHF(s.nachbearbeitung_pro_h)}/h`, styles: { fontSize: 8.5, textColor: GRAY, halign: "right", fillColor: rowBg } },
          { content: formatCHF(nbTotal), styles: { fontSize: 8.5, textColor: DARK, fontStyle: "bold", halign: "right", fillColor: rowBg } },
        ]);
      }
      if (i < data.parts.length - 1) {
        detailBody.push([{ content: "", colSpan: 5, styles: { cellPadding: 1, fillColor: WHITE } }]);
      }
    });

    // Express-Lieferung (Details-Modus)
    if ((data.expressKosten ?? 0) > 0) {
      const exLabel = data.expressLabel?.trim() || "Express-Lieferung";
      const nr = String(data.parts.length + 1).padStart(2, "0");
      detailBody.push([
        { content: nr, styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, fontSize: 8.5 } },
        { content: exLabel, styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, fontSize: 8.5 } },
        { content: "1×", styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, halign: "center", fontSize: 8.5 } },
        { content: formatCHF(data.expressKosten!), styles: { fillColor: BLACK, textColor: WHITE, halign: "right", fontSize: 8.5 } },
        { content: formatCHF(data.expressKosten!), styles: { fontStyle: "bold", fillColor: BLACK, textColor: WHITE, halign: "right", fontSize: 8.5 } },
      ]);
    }

    autoTable(doc, {
      startY: 118, margin: { left: margin, right: margin },
      head: [["Nr.", "Leistung / Beschreibung", "Menge", "Einzelpreis", "Total"]],
      body: detailBody,
      styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }, textColor: DARK },
      headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 88 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      tableLineColor: LGRAY, tableLineWidth: 0.1,
    });
  } else {
    const tableBody: any[][] = data.parts.map((p, i) => [
      String(i + 1).padStart(2, "0"), p.teilname || "—", p.material,
      `${p.menge}×`, formatCHF(p.preis_pro_stueck), formatCHF(p.preis_total),
    ]);
    if ((data.expressKosten ?? 0) > 0) {
      const exLabel = data.expressLabel?.trim() || "Express-Lieferung";
      tableBody.push([
        String(tableBody.length + 1).padStart(2, "0"),
        exLabel, "—", "1×",
        formatCHF(data.expressKosten!), formatCHF(data.expressKosten!),
      ]);
    }
    autoTable(doc, {
      startY: 118, margin: { left: margin, right: margin },
      head: [["Nr.", "Beschreibung", "Material", "Menge", "Preis/St.", "Total"]],
      body: tableBody,
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
      tableLineColor: LGRAY, tableLineWidth: 0.1,
    });
  }

  const afterTable = (doc as any).lastAutoTable.finalY + 6;
  const sumW = 70;
  const sumX = pageW - margin - sumW;

  const partsSubtotal = data.umsatz_total - (data.expressKosten ?? 0);
  const offerSumRows: [string, string][] = [["Zwischensumme", formatCHF(partsSubtotal)]];
  if ((data.expressKosten ?? 0) > 0) {
    offerSumRows.push([data.expressLabel?.trim() || "Express-Lieferung", formatCHF(data.expressKosten!)]);
  }
  const offerRabattPct = Math.max(0, Math.min(100, Number(data.rabattProzent) || 0));
  const offerRabatt = data.umsatz_total * (offerRabattPct / 100);
  if (offerRabatt > 0) {
    offerSumRows.push([`Rabatt (${offerRabattPct}%)`, `- ${formatCHF(offerRabatt)}`]);
  }
  offerSumRows.push(["MwSt. (0%)", "CHF 0.00"]);

  const totalBoxBottom = drawSummary(
    doc,
    offerSumRows,
    "ANGEBOTSSUMME", formatCHF(data.umsatz_total - offerRabatt),
    ACCENT, sumX, afterTable, pageW, margin,
  );

  // Hinweis
  const termsY = totalBoxBottom + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...BLACK);
  doc.text("HINWEIS", sumX, termsY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  const termsText = `Dieses Angebot ist gültig bis ${gueltigBis}. Bei Annahme erstellen wir eine verbindliche Auftragsbestätigung.`;
  doc.text(doc.splitTextToSize(termsText, pageW - sumX - margin), sumX, termsY + 6);

  // Dank links
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Wir freuen uns auf Ihre Rückmeldung.", margin, afterTable + 16);

  drawFooter(doc, data.company, ACCENT, pageW, pageH, margin);

  const safeName = data.customerName.replace(/[äöüÄÖÜß]/g, (c) => ({ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue',ß:'ss'}[c]||c)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Offerte_${offerNr}_${safeName}.pdf`;

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
  return null;
}

// ─── Auftragsbestätigung ─────────────────────────────────────────────────────
export async function exportAuftragsbestaetiguungPDF(data: OfferExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const GREEN: [number, number, number] = [34, 139, 34];

  const datumClean = data.datum ? new Date(data.datum + "T12:00:00").toISOString().split("T")[0].replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
  const abNr = `AB-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;

  await drawHeader(doc, data.company, pageW, margin);

  // Titel zweizeilig rechtsbündig
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...BLACK);
  doc.text("AUFTRAGS-",    pageW - margin, 22, { align: "right" });
  doc.text("BESTÄTIGUNG",  pageW - margin, 31, { align: "right" });

  // Details rechts
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text("Auftragsdetails", colR, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const datumFormatted = data.datum ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  doc.text(`Datum:           ${datumFormatted}`, colR, 44);
  doc.text(`Auftrags-Nr.:    ${abNr}`, colR, 49);

  // Bestätigt-Badge
  doc.setFillColor(...GREEN);
  doc.roundedRect(colR, 54, 38, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
  doc.text("✓  BESTÄTIGT", colR + 5, 58.8);

  drawRecipient(doc, data, "AUFTRAGGEBER", margin, pageW);

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("AUFTRAGSBESCHREIBUNG", colR, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const rawDesc2 = data.beschreibung || "—";
  const descLines = rawDesc2.split("\n").flatMap(line => doc.splitTextToSize(line || " ", pageW - colR - margin));
  doc.text(descLines.slice(0, 5), colR, 83);

  // Tabelle
  const abTableBody: any[][] = data.parts.map((p, i) => [
    String(i + 1).padStart(2, "0"), p.teilname || "—", p.material,
    `${p.menge}×`, formatCHF(p.preis_pro_stueck), formatCHF(p.preis_total),
  ]);
  if ((data.expressKosten ?? 0) > 0) {
    abTableBody.push([
      String(abTableBody.length + 1).padStart(2, "0"),
      data.expressLabel?.trim() || "Express-Lieferung", "—", "1×",
      formatCHF(data.expressKosten!), formatCHF(data.expressKosten!),
    ]);
  }
  autoTable(doc, {
    startY: 118, margin: { left: margin, right: margin },
    head: [["Nr.", "Beschreibung", "Material", "Menge", "Preis/St.", "Total"]],
    body: abTableBody,
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
    tableLineColor: LGRAY, tableLineWidth: 0.1,
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 6;
  const sumW = 70;
  const sumX = pageW - margin - sumW;

  const abPartsSubtotal = data.umsatz_total - (data.expressKosten ?? 0);
  const abSumRows: [string, string][] = [["Zwischensumme", formatCHF(abPartsSubtotal)]];
  if ((data.expressKosten ?? 0) > 0) {
    abSumRows.push([data.expressLabel?.trim() || "Express-Lieferung", formatCHF(data.expressKosten!)]);
  }
  const abRabattPct = Math.max(0, Math.min(100, Number(data.rabattProzent) || 0));
  const abRabatt = data.umsatz_total * (abRabattPct / 100);
  if (abRabatt > 0) {
    abSumRows.push([`Rabatt (${abRabattPct}%)`, `- ${formatCHF(abRabatt)}`]);
  }
  abSumRows.push(["MwSt. (0%)", "CHF 0.00"]);

  const totalBoxBottom = drawSummary(
    doc,
    abSumRows,
    "AUFTRAGSSUMME", formatCHF(data.umsatz_total - abRabatt),
    GREEN, sumX, afterTable, pageW, margin,
  );

  // Hinweis
  const termsY = totalBoxBottom + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...BLACK);
  doc.text("NÄCHSTE SCHRITTE", sumX, termsY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  const termsText = `Ihr Auftrag ist bestätigt. Wir werden uns bei Rückfragen melden und Sie über den Fortschritt informieren.`;
  doc.text(doc.splitTextToSize(termsText, pageW - sumX - margin), sumX, termsY + 6);

  // Dank links
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...GREEN);
  doc.text("Vielen Dank für Ihren Auftrag!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Wir freuen uns auf die Zusammenarbeit.", margin, afterTable + 16);

  drawFooter(doc, data.company, ACCENT, pageW, pageH, margin);

  const safeName = data.customerName.replace(/[äöüÄÖÜß]/g, (c) => ({ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue',ß:'ss'}[c]||c)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Auftragsbestaetigung_${abNr}_${safeName}.pdf`;

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
  return null;
}

// ─── Lieferschein ────────────────────────────────────────────────────────────
interface LieferscheinData {
  orderId: string;
  datum: string;
  beschreibung: string;
  customerName: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  parts: PartRow[];
  company: CompanySettings;
  trackingNr?: string;
  lieferAdresse?: string;
  notiz?: string;
  returnBase64?: boolean;
}

export async function exportLieferscheinPDF(data: LieferscheinData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");

  const datumClean = data.datum ? new Date(data.datum + "T12:00:00").toISOString().split("T")[0].replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
  const lsNr = `LS-${datumClean}-${data.orderId.slice(0, 6).toUpperCase()}`;

  await drawHeader(doc, data.company, pageW, margin);

  // Titel
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...BLACK);
  doc.text("LIEFERSCHEIN", pageW - margin, 26, { align: "right" });

  // Details rechts
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text("Lieferdetails", colR, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const datumFormatted = data.datum ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  doc.text(`Datum:           ${datumFormatted}`, colR, 44);
  doc.text(`Lieferschein-Nr.: ${lsNr}`, colR, 49);
  if (data.trackingNr) {
    doc.text(`Tracking:        ${data.trackingNr}`, colR, 54);
  }

  drawRecipient(doc, data, "LIEFERADRESSE", margin, pageW);

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("PROJEKT / BESCHREIBUNG", colR, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const rawDesc = data.beschreibung || "—";
  const descLines = rawDesc.split("\n").flatMap(line => doc.splitTextToSize(line || " ", pageW - colR - margin));
  doc.text(descLines.slice(0, 5), colR, 83);

  // Tabelle — KEINE Preise
  const lsBody: any[][] = data.parts.map((p, i) => [
    String(i + 1).padStart(2, "0"),
    p.teilname || "—",
    p.material,
    (p.gewicht_g ?? 0) > 0 ? `${p.gewicht_g} g` : "—",
    `${p.menge}×`,
  ]);

  autoTable(doc, {
    startY: 118, margin: { left: margin, right: margin },
    head: [["Nr.", "Beschreibung", "Material", "Gewicht/St.", "Menge"]],
    body: lsBody,
    styles: { fontSize: 9, cellPadding: { top: 4.5, bottom: 4.5, left: 3, right: 3 }, textColor: DARK },
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 75 },
      2: { cellWidth: 45 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: XLGRAY },
    tableLineColor: LGRAY, tableLineWidth: 0.1,
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 8;

  // Total Box: Stückzahl + Gewicht
  const totalStueck = data.parts.reduce((s, p) => s + (p.menge || 0), 0);
  const totalGewicht = data.parts.reduce((s, p) => s + ((p.gewicht_g ?? 0) * (p.menge || 0)), 0);

  const sumW = 70;
  const sumX = pageW - margin - sumW;
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
  doc.line(sumX, afterTable, pageW - margin, afterTable);
  let sy = afterTable + 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text("Total Teile", sumX, sy);
  doc.setTextColor(...DARK); doc.text(`${totalStueck} Stk.`, pageW - margin, sy, { align: "right" });
  sy += 6;
  if (totalGewicht > 0) {
    doc.setTextColor(...GRAY); doc.text("Total Gewicht", sumX, sy);
    doc.setTextColor(...DARK); doc.text(`${totalGewicht.toFixed(1)} g`, pageW - margin, sy, { align: "right" });
    sy += 6;
  }

  sy += 2;
  doc.setFillColor(...ACCENT);
  doc.rect(sumX, sy - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...WHITE);
  doc.text("LIEFERUNG", sumX + 3, sy + 3.5);
  doc.text("vollständig", pageW - margin - 3, sy + 3.5, { align: "right" });
  const totalBoxBottom = sy + 8;

  // Optionale Notiz (nur wenn vom Benutzer gesetzt)
  if (data.notiz?.trim()) {
    const noteY = totalBoxBottom + 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...BLACK);
    doc.text("HINWEIS", sumX, noteY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(doc.splitTextToSize(data.notiz.trim(), pageW - sumX - margin), sumX, noteY + 6);
  }

  // Dank links
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Wir hoffen, Sie sind mit der Lieferung zufrieden.", margin, afterTable + 16);


  drawFooter(doc, data.company, ACCENT, pageW, pageH, margin);

  const safeName = data.customerName.replace(/[äöüÄÖÜß]/g, (c) => ({ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue',ß:'ss'}[c]||c)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Lieferschein_${lsNr}_${safeName}.pdf`;

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
  return null;
}
