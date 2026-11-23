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
  /** Only worth passing for a record that can be outside the tenant's home
   *  country (e.g. a CRM record's own country picker) — Sales/Purchases
   *  addresses don't currently collect one. */
  country?: string;
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
  return [[addr.addrLine1, addr.suiteUnit].filter(Boolean).join(", "), addr.addrLine2, cityLine, addr.country].filter(
    (line): line is string => Boolean(line),
  );
}

/** Draws the "from" company block (top-left): the tenant's own name and
 *  billing address. Fetches Company Info itself — same self-contained pattern
 *  pdfBranding's logo loaders use — and silently no-ops if it isn't
 *  configured for this tenant yet. Appropriate for a document going out to a
 *  counterparty (Sales, Purchases); a profile-shaped record (CRM, Inventory)
 *  should show its own identity in this spot instead — see drawRecordTitle. */
export async function drawCompanyBlock(doc: DocWithAutoTable, cursorY: number): Promise<number> {
  try {
    const company = await companyProfileService.get();
    if (!company?.companyName) return cursorY;
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
    return y;
  } catch {
    // Company Info may not be configured for this tenant yet — omit the block.
    return cursorY;
  }
}

/** Draws a record's own name (top-left) — the CRM/Inventory-style counterpart
 *  to drawCompanyBlock, for records that don't have a "from" party because
 *  they aren't a document exchanged with one. */
export function drawRecordTitle(doc: DocWithAutoTable, cursorY: number, name: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(name, MARGIN_X, cursorY);
  return cursorY + 17;
}

/** Draws, right-aligned, an Issue/Due-style date pair and an optional lime
 *  key-amount badge (e.g. Amount Due). Pair with drawCompanyBlock or
 *  drawRecordTitle on the left and take Math.max of both return values to
 *  get the row's true bottom. */
export function drawDateAmountHeader(
  doc: DocWithAutoTable,
  pageWidth: number,
  cursorY: number,
  opts: {
    issueDate?: string;
    issueDateLabel?: string;
    dueDate?: string;
    dueDateLabel?: string;
    keyAmount?: PdfKeyAmount;
  },
): number {
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
  if (opts.issueDate) dateRow(opts.issueDateLabel || "Issue Date", opts.issueDate);
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

  return rightY;
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

/** Draws up to two labeled address cards side by side (e.g. Bill To/Ship To,
 *  a CRM record's Billing/Shipping Address, or a Purchases Vendor/Ship To).
 *  Either (or both) may be omitted — a record with no address data at all
 *  should skip this row entirely rather than call it with empty blocks. A
 *  counterparty with only a name and no address (e.g. a Sales Payment, a
 *  CRM record's Account Owner) still uses this — pass `{ customerName }`
 *  with no other fields as `left`, which renders as a single labeled line. */
export function drawAddressRow(
  doc: DocWithAutoTable,
  pageWidth: number,
  cursorY: number,
  left?: { label: string; addr: PdfAddressBlock },
  right?: { label: string; addr: PdfAddressBlock },
): number {
  if (!left && !right) return cursorY;
  const colWidth = (pageWidth - MARGIN_X * 2) / 2;
  let bottom = cursorY;
  if (left) bottom = Math.max(bottom, drawAddressBlock(doc, MARGIN_X, cursorY, left.label, left.addr));
  if (right) bottom = Math.max(bottom, drawAddressBlock(doc, MARGIN_X + colWidth + 20, cursorY, right.label, right.addr));
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
