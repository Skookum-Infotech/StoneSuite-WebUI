import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MARGIN_X,
  PAGE_BOTTOM_SAFE,
  BRAND_LIME,
  INK,
  STONE_600,
  HEADER_BAND_HEIGHT,
  HEADER_ACCENT_HEIGHT,
  drawMasthead,
  drawFooterOnAllPages,
  type DocWithAutoTable,
} from "@/lib/pdfBranding";
import {
  CARD_FILL,
  drawCompanyBlock,
  drawDateAmountHeader,
  drawAddressRow,
  drawTotalsCard,
  drawEmphasisBar,
  type PdfAddressBlock,
  type PdfKeyAmount,
  type PdfTotalRow,
} from "@/lib/pdfDocumentBlocks";
import { drawTextCard, makeItemDescriptionHooks } from "@/lib/pdfTextBlocks";

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
  /** Row-aligned with `rows` — an optional line rendered under the item name
   *  (column index 1) instead of its own column. */
  descriptions?: Array<string | undefined>;
}

export type SalesPdfTotal = PdfTotalRow;

export interface SalesExportParams {
  docType: SalesDocType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  /** Fallback name shown when there's no billTo/shipTo address data at all
   *  (Payment, Refund, Fabrication Job). Ignored once billTo or shipTo is set. */
  customerName?: string;
  issueDate?: string;
  dueDate?: string;
  /** Defaults to "Due Date"; pass e.g. "Valid Until" for Quote/Estimate. */
  dueDateLabel?: string;
  /** The one figure worth calling out twice (header badge + summary bar) —
   *  e.g. Balance Due for Invoice, Unapplied for Payment/Refund. Omit for doc
   *  types where the totals card's own Grand Total row is emphasis enough. */
  keyAmount?: PdfKeyAmount;
  billTo?: PdfAddressBlock;
  shipTo?: PdfAddressBlock;
  /** Rendered as a Notes card next to the totals summary. */
  notesText?: string;
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

const TERMS_PLACEHOLDER = "Terms will be available in a future update.";
const PAYMENT_DETAILS_PLACEHOLDER = "Bank and payment details will be available in a future update.";
const FOOTER_COLUMN_GAP = 24;
const WHITE: [number, number, number] = [255, 255, 255];

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
  const {
    docType,
    recordNumber,
    statusLabel,
    customerName,
    issueDate,
    dueDate,
    dueDateLabel,
    keyAmount,
    billTo,
    shipTo,
    notesText,
    sections,
    itemsTable,
    totals,
  } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth, DOC_TYPE_LABEL[docType], recordNumber, statusLabel);

  const headerStartY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 30;
  const companyBottom = await drawCompanyBlock(doc, headerStartY);
  const dateAmountBottom = drawDateAmountHeader(doc, pageWidth, headerStartY, { issueDate, dueDate, dueDateLabel, keyAmount });
  let cursorY = Math.max(companyBottom, dateAmountBottom) + 20;

  if (billTo || shipTo) {
    cursorY = drawAddressRow(
      doc,
      pageWidth,
      cursorY,
      billTo && { label: "Bill To", addr: billTo },
      shipTo && { label: "Ship To", addr: shipTo },
    );
  } else if (customerName) {
    cursorY = drawAddressRow(doc, pageWidth, cursorY, { label: "Customer", addr: { customerName } });
  }

  function ensureSpace(minHeight = 0) {
    if (cursorY + minHeight > pageHeight - PAGE_BOTTOM_SAFE) {
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

  if (itemsTable && itemsTable.rows.length > 0) {
    ensureSpace();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(itemsTable.title || "Line Items", MARGIN_X, cursorY);
    cursorY += 8;

    const numericFrom = itemsTable.numericFrom ?? itemsTable.head.length;
    const descriptionHooks = itemsTable.descriptions ? makeItemDescriptionHooks(doc, itemsTable.descriptions) : {};
    autoTable(doc, {
      startY: cursorY + 4,
      margin: { left: MARGIN_X, right: MARGIN_X },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: STONE_600 },
      headStyles: { fillColor: INK, textColor: WHITE },
      alternateRowStyles: { fillColor: CARD_FILL },
      head: [itemsTable.head],
      body: itemsTable.rows,
      columnStyles: Object.fromEntries(
        itemsTable.head.map((_, i) => [i, i >= numericFrom ? { halign: "right" as const } : {}]),
      ),
      ...descriptionHooks,
    });

    cursorY = doc.lastAutoTable.finalY + 18;
  }

  ensureSpace(140);
  const footerColWidth = (pageWidth - MARGIN_X * 2 - FOOTER_COLUMN_GAP) / 2;
  const footerRightX = MARGIN_X + footerColWidth + FOOTER_COLUMN_GAP;

  let footerLeftY = drawTextCard(doc, MARGIN_X, footerColWidth, cursorY, "Terms & Conditions", TERMS_PLACEHOLDER, {
    placeholder: true,
  });
  if (notesText) {
    footerLeftY = drawTextCard(doc, MARGIN_X, footerColWidth, footerLeftY + 12, "Notes", notesText);
  }

  let footerRightY = cursorY;
  if (totals && totals.length > 0) {
    footerRightY = drawTotalsCard(doc, footerRightX, footerColWidth, footerRightY, totals) + 10;
  }
  if (keyAmount) {
    footerRightY = drawEmphasisBar(doc, footerRightX, footerColWidth, footerRightY, keyAmount);
  }

  cursorY = Math.max(footerLeftY, footerRightY) + 8;

  ensureSpace(70);
  cursorY =
    drawTextCard(doc, MARGIN_X, pageWidth - MARGIN_X * 2, cursorY, "Payment Details", PAYMENT_DETAILS_PLACEHOLDER, {
      placeholder: true,
    }) + 10;

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Sales — ${DOC_TYPE_LABEL[docType]}`);

  return doc;
}

/** Builds and downloads a branded PDF summary of a Sales document. */
export async function exportSalesDocToPdf(params: SalesExportParams): Promise<void> {
  const doc = await buildSalesDocPdf(params);
  doc.save(buildExportFilename(params.docType, params.recordNumber, params.title));
}
