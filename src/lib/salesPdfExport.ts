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

export type SalesDocType =
  | "sales_order"
  | "invoice"
  | "estimate"
  | "quote"
  | "credit_memo"
  | "payment"
  | "refund"
  | "fabrication_job";

export interface SalesPdfSection {
  title: string;
  /** [label, value] pairs. Rows with an empty value are dropped. */
  rows: Array<[string, string]>;
}

export interface SalesPdfTable {
  title?: string;
  head: string[];
  rows: string[][];
  /** Column index (0-based) from which cells are right-aligned, e.g. numeric/currency columns. */
  numericFrom?: number;
}

export interface SalesPdfTotal {
  label: string;
  value: string;
  bold?: boolean;
}

export interface SalesExportParams {
  docType: SalesDocType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  customerName?: string;
  createdAt?: string;
  updatedAt?: string;
  sections: SalesPdfSection[];
  itemsTable?: SalesPdfTable;
  totals?: SalesPdfTotal[];
}

const DOC_TYPE_LABEL: Record<SalesDocType, string> = {
  sales_order: "Sales Order",
  invoice: "Invoice",
  estimate: "Estimate",
  quote: "Quote",
  credit_memo: "Credit Memo",
  payment: "Payment",
  refund: "Refund",
  fabrication_job: "Fabrication Job",
};

export function buildExportFilename(
  docType: SalesDocType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || docType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${docType}-${safeName}.pdf`;
}

/** Builds a branded PDF summary of a Sales document (Sales Order, Invoice,
 *  Estimate, Quote, Credit Memo, Payment, Refund, or Fabrication Job). */
export async function buildSalesDocPdf(params: SalesExportParams): Promise<DocWithAutoTable> {
  const { docType, title, recordNumber, statusLabel, customerName, createdAt, updatedAt, sections, itemsTable, totals } =
    params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth);

  let cursorY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK_ACCENT);
  doc.text("SALES DOCUMENT SUMMARY", MARGIN_X, cursorY, { charSpace: 1.4 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STONE_400);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - MARGIN_X, cursorY, {
    align: "right",
  });

  cursorY += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(title || "(unnamed)", MARGIN_X, cursorY);

  cursorY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...STONE_600);
  const subtitleParts = [DOC_TYPE_LABEL[docType], recordNumber].filter(Boolean);
  doc.text(subtitleParts.join("  ·  "), MARGIN_X, cursorY);

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
      ["Status", statusLabel || "—", "Customer", customerName || "—"],
      ["Created", fmtDate(createdAt || ""), "Updated", fmtDate(updatedAt || "")],
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

  if (totals && totals.length > 0) {
    ensureSpace();

    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "plain",
      tableWidth: "wrap",
      styles: { fontSize: 7, cellPadding: 4 },
      head: [totals.map((t) => t.label.toUpperCase())],
      headStyles: { textColor: STONE_400, fontStyle: "normal" },
      body: [totals.map((t) => t.value)],
      bodyStyles: { textColor: INK, fontSize: 10 },
      columnStyles: Object.fromEntries(
        totals.map((t, i) => [i, t.bold ? { fontStyle: "bold" as const } : {}]),
      ),
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  if (itemsTable && itemsTable.rows.length > 0) {
    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(itemsTable.title || "Line Items", MARGIN_X, cursorY);
    cursorY += 8;

    const numericFrom = itemsTable.numericFrom ?? itemsTable.head.length;
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: BRAND_LIME, textColor: INK },
      head: [itemsTable.head],
      body: itemsTable.rows,
      columnStyles: Object.fromEntries(
        itemsTable.head.map((_, i) => [i, i >= numericFrom ? { halign: "right" as const } : {}]),
      ),
    });

    cursorY = doc.lastAutoTable.finalY + 20;
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Sales — ${DOC_TYPE_LABEL[docType]}`);

  return doc;
}

/** Builds and downloads a branded PDF summary of a Sales document. */
export async function exportSalesDocToPdf(params: SalesExportParams): Promise<void> {
  const doc = await buildSalesDocPdf(params);
  doc.save(buildExportFilename(params.docType, params.recordNumber, params.title));
}
