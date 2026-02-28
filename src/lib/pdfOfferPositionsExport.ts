import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { OfferPosition } from "@/components/OfferMode";

interface ExportProps {
  orderId: string;
  datum: string;
  orderName?: string;
  beschreibung?: string;
  offerNote?: string;
  positions: OfferPosition[];
  total: number;
  company: Record<string, string>;
  customerName?: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  returnBase64?: boolean;
}

export async function exportOfferPositionsPDF(props: ExportProps): Promise<{ base64: string; filename: string } | void> {
  const {
    orderId, datum, orderName, beschreibung, offerNote,
    positions, total, company,
    customerName = "Kein Kunde", customerFirma, customerAdresse,
    returnBase64,
  } = props;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const accent = [37, 99, 235] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];
  const light = [240, 245, 255] as [number, number, number];

  // Header background
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, 38, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(company.name || "3DMuscio", 14, 16);

  // OFFERTE label
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("OFFERTE", pageW - 14, 16, { align: "right" });

  // Offer number & date
  const offerNr = `OF-${orderId.slice(0, 6).toUpperCase()}`;
  doc.setFontSize(9);
  doc.text(`Nr: ${offerNr}`, pageW - 14, 22, { align: "right" });
  doc.text(`Datum: ${datum}`, pageW - 14, 28, { align: "right" });

  // Validity
  const validUntil = new Date(datum);
  validUntil.setDate(validUntil.getDate() + 30);
  doc.text(`Gültig bis: ${validUntil.toISOString().split("T")[0]}`, pageW - 14, 34, { align: "right" });

  // Company details in header
  if (company.address || company.email) {
    doc.setFontSize(8);
    doc.text([company.address || "", company.email || ""].filter(Boolean).join(" | "), 14, 26);
  }

  let y = 50;

  // Customer block
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("An:", 14, y);
  doc.setFont("helvetica", "normal");
  if (customerFirma) { doc.text(customerFirma, 30, y); y += 5; }
  doc.text(customerName, 30, y); y += 5;
  if (customerAdresse) { doc.text(customerAdresse, 30, y); y += 5; }
  y += 4;

  // Subject
  if (orderName || beschreibung) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(`Betreff: ${orderName || "Offerte"}`, 14, y);
    y += 6;
    if (beschreibung) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...gray);
      const lines = doc.splitTextToSize(beschreibung, pageW - 28) as string[];
      doc.text(lines, 14, y);
      y += lines.length * 4 + 4;
    }
  }

  y += 2;

  // Positions table
  autoTable(doc, {
    startY: y,
    head: [["#", "Bezeichnung / Tätigkeit", "Menge", "Einheit", "Preis/Einheit", "Total"]],
    body: positions.map((p, i) => [
      i + 1,
      p.bezeichnung + (p.notiz ? `\n${p.notiz}` : ""),
      p.menge,
      p.einheit,
      `CHF ${p.preis_pro_einheit.toFixed(2)}`,
      `CHF ${(p.menge * p.preis_pro_einheit).toFixed(2)}`,
    ]),
    foot: [["", "", "", "", "Gesamtbetrag", `CHF ${total.toFixed(2)}`]],
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: light, textColor: [30, 30, 30], fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 15, halign: "right" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Note / Konditionen
  if (offerNote) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("Bemerkungen / Konditionen:", 14, finalY);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(offerNote, pageW - 28) as string[];
    doc.text(noteLines, 14, finalY + 5);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, footerY - 4, pageW, 16, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Vielen Dank für Ihr Vertrauen!", pageW / 2, footerY + 3, { align: "center" });

  const filename = `Offerte_${offerNr}_${datum}.pdf`;

  if (returnBase64) {
    const base64 = doc.output("datauristring").split(",")[1];
    return { base64, filename };
  }

  doc.save(filename);
}
