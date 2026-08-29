import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MARGIN_X,
  PAGE_BOTTOM_SAFE,
  BRAND_LIME,
  BRAND_DARK_ACCENT,
  INK,
  STONE_200,
  STONE_400,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  fmtDate,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";

// Feedback-domain PDF exporter — a sibling of crmPdfExport.ts/salesPdfExport.ts/
// purchasesPdfExport.ts/financePdfExport.ts (same masthead/section/table/
// footer shape via pdfBranding.ts). A ticket is profile/header-shaped like a
// Vendor or Chart of Accounts record: no line items, no totals — just a
// labeled record with a timeline appended as its own table.

export interface FeedbackPdfSection {
  title: string;
  /** [label, value] pairs. Rows with an empty value are dropped. */
  rows: Array<[string, string]>;
}

export interface FeedbackTimelineRow {
  when: string;
  who: string;
  what: string;
}

export interface FeedbackExportParams {
  ticketNumber: string;
  title: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  sections: FeedbackPdfSection[];
  timeline: FeedbackTimelineRow[];
}

export function buildFeedbackExportFilename(ticketNumber: string): string {
  const safeName = (ticketNumber || "ticket").replace(/[^a-z0-9-_]+/gi, "-");
  return `feedback-${safeName}.pdf`;
}

/** Builds a branded PDF summary of a feedback ticket, including its timeline. */
export async function buildFeedbackTicketPdf(params: FeedbackExportParams): Promise<DocWithAutoTable> {
  const { ticketNumber, title, statusLabel, createdAt, updatedAt, sections, timeline } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK_ACCENT);
  doc.text("FEEDBACK TICKET SUMMARY", MARGIN_X, cursorY, { charSpace: 1.4 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STONE_400);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - MARGIN_X, cursorY, { align: "right" });

  cursorY += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(title || "(no description)", MARGIN_X, cursorY, { maxWidth: pageWidth - MARGIN_X * 2 });

  cursorY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...STONE_600);
  doc.text(["Support Ticket", ticketNumber].filter(Boolean).join("  ·  "), MARGIN_X, cursorY);

  cursorY += 16;
  doc.setDrawColor(...STONE_200);
  doc.setLineWidth(0.75);
  doc.line(MARGIN_X, cursorY, pageWidth - MARGIN_X, cursorY);
  cursorY += 20;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: "plain",
    styles: { fontSize: 9, textColor: STONE_600, cellPadding: 2 },
    body: [
      ["Status", statusLabel || "—", "Created", fmtDate(createdAt)],
      ["Updated", fmtDate(updatedAt), "", ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
      2: { fontStyle: "bold", textColor: INK, cellWidth: 90 },
    },
  });

  cursorY = doc.lastAutoTable.finalY + 20;

  function ensureSpace() {
    if (cursorY > pageHeight - PAGE_BOTTOM_SAFE) {
      doc.addPage();
      cursorY = 44;
    }
  }

  for (const section of sections) {
    const rows = section.rows.filter(([, value]) => value !== "");
    if (rows.length === 0) continue;

    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(section.title, MARGIN_X, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [["Field", "Value"]],
      body: rows,
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" } },
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  if (timeline.length > 0) {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text("Timeline", MARGIN_X, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 5, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [["When", "Who", "What"]],
      body: timeline.map((t) => [t.when, t.who, t.what]),
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  drawFooterOnAllPages(doc, pageHeight, "StoneSuite Platform — Feedback Ticket");

  return doc;
}

/** Builds and downloads a branded PDF summary of a feedback ticket. */
export async function exportFeedbackTicketToPdf(params: FeedbackExportParams): Promise<void> {
  const doc = await buildFeedbackTicketPdf(params);
  doc.save(buildFeedbackExportFilename(params.ticketNumber));
}
