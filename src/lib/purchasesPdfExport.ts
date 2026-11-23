import { toast } from "sonner";
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
  drawRecordTitle,
  drawDateAmountHeader,
  drawAddressRow,
  drawTotalsCard,
  drawEmphasisBar,
  type PdfAddressBlock,
  type PdfKeyAmount,
  type PdfTotalRow,
} from "@/lib/pdfDocumentBlocks";
import { drawTextCard, makeItemDescriptionHooks } from "@/lib/pdfTextBlocks";

// Purchases-domain PDF exporter — a sibling of salesPdfExport.ts (same
// masthead/header/address/totals/text-card shape via pdfDocumentBlocks.ts +
// pdfTextBlocks.ts), scoped to the Purchases module: Requisition, Purchase
// Order, Item Receipt, Vendor Bill, Vendor Payment and Vendor Credit are
// document-shaped (a counterparty, header info, usually line items); Expense
// is document-shaped around a claimant instead of a vendor; Vendor is
// profile-shaped — it IS the counterparty, so it gets the CRM/Inventory-style
// "own record" header (drawRecordTitle) instead of the "from our company"
// header the other 7 use (drawCompanyBlock).

export type PurchasesRecordType =
  | "requisition" | "purchase_order" | "item_receipt" | "vendor" | "vendor_bill" | "vendor_payment"
  | "vendor_credit" | "expense";

export interface PurchasesPdfSection {
  title: string;
  /** [label, value] pairs. Rows with an empty value are dropped. */
  rows: Array<[string, string]>;
}

export interface PurchasesPdfTable {
  title?: string;
  head: string[];
  rows: string[][];
  /** Column index (0-based) from which cells are right-aligned, e.g. numeric columns. */
  numericFrom?: number;
  /** Row-aligned with `rows` — an optional line rendered under the item name
   *  (column index 1) instead of its own column. */
  descriptions?: Array<string | undefined>;
}

export type PurchasesPdfTotal = PdfTotalRow;

export interface PurchasesExportParams {
  recordType: PurchasesRecordType;
  title: string;
  recordNumber?: string;
  statusLabel?: string;
  issueDate?: string;
  /** Defaults to "Issue Date". */
  issueDateLabel?: string;
  dueDate?: string;
  /** Defaults to "Due Date". */
  dueDateLabel?: string;
  /** The one figure worth calling out twice (header badge + summary bar) —
   *  e.g. Balance Due for Vendor Bill, Unapplied for Vendor Payment/Credit. */
  keyAmount?: PdfKeyAmount;
  /** Defaults to "Vendor" — Requisition uses "Suggested Vendor", Expense uses
   *  "Claimant" since it has no vendor at all. */
  counterpartyLabel?: string;
  counterpartyName?: string;
  /** Purchase Order only, today — a full ship-to address paired alongside the
   *  counterparty as a second card. */
  shipTo?: PdfAddressBlock;
  /** Rendered as a Notes card next to the totals summary. */
  notesText?: string;
  /** Rendered as the Terms & Conditions card's real content instead of the
   *  "coming soon" placeholder — only Purchase Order and Vendor Bill have
   *  their own terms field today. */
  termsText?: string;
  sections: PurchasesPdfSection[];
  itemsTable?: PurchasesPdfTable;
  totals?: PurchasesPdfTotal[];
}

const RECORD_TYPE_LABEL: Record<PurchasesRecordType, string> = {
  requisition: "Requisition",
  purchase_order: "Purchase Order",
  item_receipt: "Item Receipt",
  vendor: "Vendor",
  vendor_bill: "Vendor Bill",
  vendor_payment: "Vendor Payment",
  vendor_credit: "Vendor Credit",
  expense: "Expense",
};

const TERMS_PLACEHOLDER = "Terms will be available in a future update.";
const PAYMENT_DETAILS_PLACEHOLDER = "Bank and payment details will be available in a future update.";
const FOOTER_COLUMN_GAP = 24;
const WHITE: [number, number, number] = [255, 255, 255];

export function buildExportFilename(
  recordType: PurchasesRecordType,
  recordNumber: string | undefined,
  title: string,
): string {
  const safeName = (recordNumber || title || recordType).replace(/[^a-z0-9-_]+/gi, "-");
  return `${recordType}-${safeName}.pdf`;
}

/** Builds a branded PDF summary of a Purchases record. */
export async function buildPurchasesRecordPdf(params: PurchasesExportParams): Promise<DocWithAutoTable> {
  const {
    recordType,
    title,
    recordNumber,
    statusLabel,
    issueDate,
    issueDateLabel,
    dueDate,
    dueDateLabel,
    keyAmount,
    counterpartyLabel,
    counterpartyName,
    shipTo,
    notesText,
    termsText,
    sections,
    itemsTable,
    totals,
  } = params;

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await drawMasthead(doc, pageWidth, RECORD_TYPE_LABEL[recordType], recordNumber, statusLabel);

  const headerStartY = HEADER_BAND_HEIGHT + HEADER_ACCENT_HEIGHT + 30;
  // Vendor IS the counterparty — a profile record like a CRM Customer, not a
  // document exchanged with one, so it shows its own name up top instead of
  // "our" company.
  const leftBottom =
    recordType === "vendor" ? drawRecordTitle(doc, headerStartY, title || "(unnamed)") : await drawCompanyBlock(doc, headerStartY);
  const rightBottom = drawDateAmountHeader(doc, pageWidth, headerStartY, {
    issueDate, issueDateLabel, dueDate, dueDateLabel, keyAmount,
  });
  let cursorY = Math.max(leftBottom, rightBottom) + 20;

  const counterpartyBlock: PdfAddressBlock | undefined = counterpartyName ? { customerName: counterpartyName } : undefined;
  if (counterpartyBlock || shipTo) {
    cursorY = drawAddressRow(
      doc,
      pageWidth,
      cursorY,
      counterpartyBlock && { label: counterpartyLabel || "Vendor", addr: counterpartyBlock },
      shipTo && { label: "Ship To", addr: shipTo },
    );
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

  // Vendor is a profile record, not a transaction — Terms & Payment Details
  // don't apply to it the way they do to the other 7 (documents involving a
  // vendor), so it skips straight to the footer.
  if (recordType !== "vendor") {
    ensureSpace(140);
    const footerColWidth = (pageWidth - MARGIN_X * 2 - FOOTER_COLUMN_GAP) / 2;
    const footerRightX = MARGIN_X + footerColWidth + FOOTER_COLUMN_GAP;

    let footerLeftY = termsText
      ? drawTextCard(doc, MARGIN_X, footerColWidth, cursorY, "Terms & Conditions", termsText)
      : drawTextCard(doc, MARGIN_X, footerColWidth, cursorY, "Terms & Conditions", TERMS_PLACEHOLDER, { placeholder: true });
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
  }

  drawFooterOnAllPages(doc, pageHeight, `StoneSuite Purchases — ${RECORD_TYPE_LABEL[recordType]}`);

  return doc;
}

/** Builds and downloads a branded PDF summary of a Purchases record. */
export async function exportPurchasesRecordToPdf(params: PurchasesExportParams): Promise<void> {
  const doc = await buildPurchasesRecordPdf(params);
  doc.save(buildExportFilename(params.recordType, params.recordNumber, params.title));
  toast.success("Downloaded successfully!");
}
