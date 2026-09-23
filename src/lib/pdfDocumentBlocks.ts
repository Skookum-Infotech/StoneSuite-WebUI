import { companyProfileService } from "@/services/companyProfileService";
import type { Address } from "@/types/companyProfile";
import {
  type DocWithAutoTable,
  MARGIN_X,
  BRAND_LIME,
  BRAND_DARK_ACCENT,
  INK,
  STONE_400,
  STONE_600,
} from "@/lib/pdfBranding";

/** Reusable "invoice-style" content blocks (company/date header, address cards,
 *  key-amount badge, totals card) shared across domain PDF exporters — built on
 *  top of pdfBranding.ts's masthead/footer chrome. Text-paragraph cards and the
 *  item-description table hooks live in the sibling pdfTextBlocks.ts. */

export const CARD_FILL: [number, number, number] = [250, 249, 247];
const CARD_RADIUS = 6;
const LABEL_UNDERLINE_WIDTH = 22;
const ROW_GAP = 13;

export interface PdfAddressBlock {
  customerName?: string;
  attention?: string;
  addrLine1?: string;
  addrLine2?: string;
  suiteUnit?: string;
  city?: string;
  zip?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

export interface PdfKeyAmount {
  label: string;
  value: string;
}

export interface PdfTotalRow {
  label: string;
  value: string;
  bold?: boolean;
}

function drawLabelWithUnderline(doc: DocWithAutoTable, x: number, y: number, label: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...STONE_400);
  doc.text(label.toUpperCase(), x, y, { charSpace: 1 });
  doc.setDrawColor(...BRAND_DARK_ACCENT);
  doc.setLineWidth(1.5);
  doc.line(x, y + 4, x + LABEL_UNDERLINE_WIDTH, y + 4);
}

function companyAddressLines(addr: Address): string[] {
  const cityLine = [addr.city, addr.state, addr.zip].filter(Boolean).join(" ");
  return [[addr.line1, addr.suite].filter(Boolean).join(", "), addr.line2, cityLine, addr.country].filter(
    (line): line is string => Boolean(line),
  );
}

function customerAddressLines(addr: PdfAddressBlock): string[] {
  const cityLine = [addr.city, addr.zip].filter(Boolean).join(" ");
  return [[addr.addrLine1, addr.suiteUnit].filter(Boolean).join(", "), addr.addrLine2, cityLine].filter(
    (line): line is string => Boolean(line),
  );
}

/** Draws the "from" company block (top-left) and, to its right, Issue/Due date
 *  and an optional lime key-amount badge (e.g. Amount Due). Fetches the tenant's
 *  Company Info itself — same self-contained pattern pdfBranding's logo loaders
 *  use — and silently omits the company block if it isn't configured yet.
 *  Returns the cursorY to continue drawing from. */
export async function drawDocumentHeader(
  doc: DocWithAutoTable,
  pageWidth: number,
  cursorY: number,
  opts: { issueDate?: string; dueDate?: string; dueDateLabel?: string; keyAmount?: PdfKeyAmount },
): Promise<number> {
  let leftBottom = cursorY;
  try {
    const company = await companyProfileService.get();
    if (company?.companyName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...INK);
      doc.text(company.companyName, MARGIN_X, cursorY);
      let y = cursorY + 17;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...STONE_600);
      for (const line of companyAddressLines(company.billingAddress)) {
        doc.text(line, MARGIN_X, y);
        y += ROW_GAP;
      }
      leftBottom = y;
    }
  } catch {
    // Company Info may not be configured for this tenant yet — omit the block.
  }

  const valueX = pageWidth - MARGIN_X;
  const labelX = valueX - 92;
  let rightY = cursorY;

  function dateRow(label: string, value: string): void {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...STONE_400);
    doc.text(label.toUpperCase(), labelX, rightY, { align: "right", charSpace: 1 });
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(value, valueX, rightY, { align: "right" });
    rightY += 18;
  }
  if (opts.issueDate) dateRow("Issue Date", opts.issueDate);
  if (opts.dueDate) dateRow(opts.dueDateLabel || "Due Date", opts.dueDate);

  if (opts.keyAmount) {
    rightY += 8;
    const badgeH = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const labelW = doc.getTextWidth(opts.keyAmount.label.toUpperCase());
    doc.setFontSize(17);
    const valueW = doc.getTextWidth(opts.keyAmount.value);
    const badgeW = Math.max(labelW, valueW) + 96;
    const badgeX = valueX - badgeW;

    doc.setFillColor(...BRAND_LIME);
    doc.roundedRect(badgeX, rightY, badgeW, badgeH, CARD_RADIUS, CARD_RADIUS, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_DARK_ACCENT);
    doc.text(opts.keyAmount.label.toUpperCase(), badgeX + 14, rightY + badgeH / 2 - 3, { charSpace: 0.8 });
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(opts.keyAmount.value, valueX - 14, rightY + badgeH / 2 + 7, { align: "right" });
    rightY += badgeH;
  }

  return Math.max(leftBottom, rightY) + 20;
}

function drawAddressBlock(doc: DocWithAutoTable, x: number, cursorY: number, label: string, addr: PdfAddressBlock): number {
  drawLabelWithUnderline(doc, x, cursorY, label);
  let y = cursorY + 20;
  if (addr.customerName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(addr.customerName, x, y);
    y += 15;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...STONE_600);
  const lines = [
    addr.attention,
    ...customerAddressLines(addr),
    addr.phone && `Phone: ${addr.phone}`,
    addr.email && `Email: ${addr.email}`,
  ].filter((line): line is string => Boolean(line));
  for (const line of lines) {
    doc.text(line, x, y);
    y += ROW_GAP;
  }
  return y;
}

/** Fallback for doc types with a customer but no address data of their own
 *  (Payment, Refund, Fabrication Job) — a single labeled name line instead of
 *  a full Bill To / Ship To row. */
export function drawCustomerLine(doc: DocWithAutoTable, x: number, cursorY: number, name: string): number {
  drawLabelWithUnderline(doc, x, cursorY, "Customer");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(name, x, cursorY + 20);
  return cursorY + 20 + 15;
}

/** Draws Bill To / Ship To as two labeled address cards side by side. Either
 *  (or both) may be omitted — a doc type with no address data (e.g. Payment)
 *  should skip this row entirely rather than call it with empty blocks. */
export function drawBillShipRow(
  doc: DocWithAutoTable,
  pageWidth: number,
  cursorY: number,
  billTo?: PdfAddressBlock,
  shipTo?: PdfAddressBlock,
): number {
  if (!billTo && !shipTo) return cursorY;
  const colWidth = (pageWidth - MARGIN_X * 2) / 2;
  let bottom = cursorY;
  if (billTo) bottom = Math.max(bottom, drawAddressBlock(doc, MARGIN_X, cursorY, "Bill To", billTo));
  if (shipTo) bottom = Math.max(bottom, drawAddressBlock(doc, MARGIN_X + colWidth + 20, cursorY, "Ship To", shipTo));
  return bottom + 16;
}

/** Light card listing Subtotal/Tax/Grand Total-style rows. Bold rows render in
 *  ink; everything else in muted stone. */
export function drawTotalsCard(doc: DocWithAutoTable, x: number, width: number, cursorY: number, totals: PdfTotalRow[]): number {
  if (totals.length === 0) return cursorY;
  const paddingTop = 18;
  const rowH = 18;
  const height = paddingTop + totals.length * rowH + 6;

  doc.setFillColor(...CARD_FILL);
  doc.roundedRect(x, cursorY, width, height, CARD_RADIUS, CARD_RADIUS, "F");

  let y = cursorY + paddingTop;
  for (const row of totals) {
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...(row.bold ? INK : STONE_600));
    doc.text(row.label, x + 16, y);
    doc.text(row.value, x + width - 16, y, { align: "right" });
    y += rowH;
  }
  return cursorY + height;
}

/** Dark emphasis bar for the one figure that deserves top-of-mind treatment
 *  (e.g. Balance Due) — paired with the same value in drawDocumentHeader's badge. */
export function drawEmphasisBar(doc: DocWithAutoTable, x: number, width: number, cursorY: number, keyAmount: PdfKeyAmount): number {
  const height = 34;
  doc.setFillColor(...INK);
  doc.roundedRect(x, cursorY, width, height, CARD_RADIUS, CARD_RADIUS, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(keyAmount.label, x + 16, cursorY + height / 2 + 4);
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_LIME);
  doc.text(keyAmount.value, x + width - 16, cursorY + height / 2 + 4, { align: "right" });
  return cursorY + height;
}
