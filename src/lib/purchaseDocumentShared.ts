import {
  docLineId, lineReviewKey, type HandoffLine, type HandoffParty, type ProvenanceInfo, type ReviewItem,
} from '@/lib/documentHandoffShared';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import { buildLine, money, orderLines, parseMoney, provenanceOf } from '@/lib/salesOrderDocumentHandoff';
import type { HandoffBadges } from '@/lib/salesOrderHandoffTypes';
import type {
  CustomerMatch, ExtractedField, ExtractedResult, ExtractionResolution, LineMatch,
} from '@/types/documentExtraction';

// Pieces of the Purchase Order and Vendor Bill handoffs that are the same for
// both: the vendor, the lines, the tax check and the document-level warnings.

const CENTS = 100;
const MILLI = 1000;
const WRONG_TYPE_PREFIX = 'document_looks_like_';
const WARN_NOT_RECOGNIZED = 'document_not_recognized';
const WARN_NO_LINE_TABLE = 'no_line_table';
const WARN_NO_PRICES = 'no_prices';
const WARN_CUSTOMER_PO = 'looks_like_customer_po';
const WARN_CREDIT = 'credit_document';
const CLASS_ORDER_FORM = 'order_form';
/** item_name is a VARCHAR(150) and a free-text line's description is saved there too. */
export const MAX_FREE_TEXT_LINE_CHARS = 150;
/** Review key of document-level findings (no row to jump to). */
export const DOCUMENT_KEY = 'document';
const MISMATCH_KEY = 'documentType';
const VENDOR_CREDIT_NEW_PATH = '/purchases/vendor_credit/new';

/** The purchase document types this module builds handoffs for. */
export type PurchaseDocType = 'purchase_order' | 'vendor_bill';

/** The fields of a form line a purchase handoff sets (the money columns are calculated per type). */
export interface PurchaseLineFields {
  id: string;
  lineNo: number;
  itemName: string;
  itemDescription: string;
  itemSku: string;
  units: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  inventoryItemUuid?: string;
}

/** The lines of an extraction as form-line fields plus their review metadata. */
export interface BuiltPurchaseLines {
  fields: PurchaseLineFields[];
  lines: HandoffLine[];
  reviewItems: ReviewItem[];
  provenance: Record<string, ProvenanceInfo>;
  convertedUnits: boolean;
}

/** Builds the form-line fields from an extraction's lines. A free-text line's
 *  description is cut to the length the server can store, with a review item,
 *  rather than being refused on save. */
export function buildPurchaseLines(ex: ExtractedResult, res: ExtractionResolution): BuiltPurchaseLines {
  const exLines = ex.lines ?? [];
  const matches = new Map<number, LineMatch>((res.lines ?? []).map((m) => [m.index, m]));
  const order = orderLines(exLines);
  const lineNoByDoc = new Map<number, number>(order.map((docIndex, i) => [docIndex, i + 1]));
  const out: BuiltPurchaseLines = { fields: [], lines: [], reviewItems: [], provenance: {}, convertedUnits: false };
  order.forEach((docIndex) => {
    const l = exLines[docIndex];
    const lineNo = lineNoByDoc.get(docIndex) as number;
    const parentLineNo = l.kind === 'addon' && l.parentLine ? lineNoByDoc.get(l.parentLine - 1) : undefined;
    const built = buildLine(l, docIndex, lineNo, matches.get(docIndex), parentLineNo, { comparePrice: false });
    const { item } = built;
    const tooLong = !item.inventoryItemUuid && item.itemDescription.length > MAX_FREE_TEXT_LINE_CHARS;
    out.fields.push({
      id: docLineId(docIndex), lineNo, itemName: item.itemName, itemSku: item.itemSku, units: item.units,
      itemDescription: tooLong ? item.itemDescription.slice(0, MAX_FREE_TEXT_LINE_CHARS).trimEnd() : item.itemDescription,
      quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, inventoryItemUuid: item.inventoryItemUuid,
    });
    out.lines.push(built.meta);
    out.reviewItems.push(...built.review);
    if (tooLong) {
      out.reviewItems.push({
        key: lineReviewKey(lineNo), label: `Line ${lineNo}`, required: false,
        reason: `The description was longer than ${MAX_FREE_TEXT_LINE_CHARS} characters, so it was shortened - the full text is under "Document" below. Pick an item to keep it whole.`,
      });
    }
    out.convertedUnits ||= built.converted;
    out.provenance[lineReviewKey(lineNo)] = provenanceOf(l.description.value ? l.description : l.sku);
  });
  return out;
}

/** The vendor the server resolved (or the candidates when it could not), with its review item. */
export interface BuiltVendor {
  party: HandoffParty;
  provenance: ProvenanceInfo;
  item: ReviewItem | null;
}

const NO_VENDOR: CustomerMatch = { active: false, confidence: 'not_found', source: 'document' };

/** Reads `resolution.vendor` into the handoff's party; an unresolved or inactive vendor is a required pick. */
export function buildVendor(
  res: ExtractionResolution, vendorName: ExtractedField | undefined, key: string, label: string,
): BuiltVendor {
  const v = res.vendor ?? NO_VENDOR;
  const named = vendorName ?? { value: '', source: 'document', confidence: 'not_found' } as ExtractedField;
  const inactive = Boolean(v.uuid) && !v.active;
  const resolved = v.uuid && v.active ? { id: v.uuid, name: v.name ?? named.value } : null;
  let item: ReviewItem | null = null;
  if (!resolved) {
    item = {
      key, label, required: true,
      reason: inactive ? `${v.name ?? 'The matched vendor'} is not active - pick another vendor.` : 'Vendor not matched - pick one.',
    };
  } else if (v.confidence !== 'high') {
    item = { key, label, required: false, reason: 'Check the matched vendor.' };
  }
  return {
    party: { resolved, extractedText: named.value, candidates: v.candidates ?? [], inactive },
    provenance: { ...provenanceOf(named), source: v.source, confidence: v.confidence },
    item,
  };
}

/** Flags a header value the extractor itself was unsure of. */
export function lowConfidenceItem(key: string, label: string, f: ExtractedField | undefined): ReviewItem | null {
  if (!f?.value || (f.confidence !== 'check' && f.confidence !== 'not_found')) return null;
  return { key, label, required: false, reason: 'Confidence is low - check this value against the document.' };
}

/** StoneSuite computes tax from the Sales Tax %, never from the document, so a
 *  document that charges tax gets a required check quoting the implied rate. */
export function purchaseTaxItem(key: string, label: string, noun: string, docTax: number, docSubtotal: number | null): ReviewItem | null {
  if (docTax <= 0) return null;
  const rate = docSubtotal && docSubtotal > 0 ? Math.round((docTax / docSubtotal) * 100 * MILLI) / MILLI : null;
  const implied = rate === null ? '' : ` (about ${rate}% of the subtotal)`;
  return {
    key, label, required: true, resolvedByReview: true,
    reason: `The document charges $${money(docTax)} tax${implied}. Set the Sales Tax % so the ${noun} charges the same tax, then mark it reviewed.`,
  };
}

/** Document total minus its tax, in dollars; null when no total was found. */
export function preTaxTotal(total: ExtractedField, tax: ExtractedField): { docTotal: number | null; docTax: number } {
  const rawTotal = parseMoney(total.value);
  const docTax = parseMoney(tax.value) ?? 0;
  return { docTotal: rawTotal === null ? null : Math.round((rawTotal - docTax) * CENTS) / CENTS, docTax };
}

/** The wrong-type badge text for the document's warnings ('' when none). */
export function wrongTypeBadge(warnings: string[]): string {
  if (warnings.includes(WARN_CUSTOMER_PO)) return "customer's purchase order";
  const wrong = warnings.find((w) => w.startsWith(WRONG_TYPE_PREFIX));
  return wrong ? wrong.slice(WRONG_TYPE_PREFIX.length).replace(/_/g, ' ') : '';
}

const NOUNS: Record<PurchaseDocType, string> = { purchase_order: 'purchase order', vendor_bill: 'vendor bill' };

/** Document-level findings from the extractor's warnings: not a recognised
 *  document, no table, no prices, a customer's PO, a credit, the wrong kind of
 *  document, and instruction-like text. */
export function documentWarningItems(docType: PurchaseDocType, ex: ExtractedResult, noLines: boolean): ReviewItem[] {
  const warnings = ex.warnings ?? [];
  const noun = NOUNS[docType];
  const out: ReviewItem[] = [];
  const doc = (reason: string): void => { out.push({ key: DOCUMENT_KEY, label: 'Document', required: false, reason }); };
  if (warnings.includes(WARN_NOT_RECOGNIZED)) {
    doc(`This doesn't look like a ${noun} - no item table, number or vendor was found. Check you uploaded the right file.`);
  } else if (warnings.includes(WARN_NO_LINE_TABLE) && noLines) {
    doc('No item table was found in the document - add the lines below by hand.');
  }
  if (warnings.includes(WARN_NO_PRICES)) {
    const kind = ex.classifiedAs && ex.classifiedAs !== CLASS_ORDER_FORM ? 'document' : 'order form';
    doc(`This ${kind} has no prices - set the price on each line.`);
  }
  if (warnings.includes(WARN_CUSTOMER_PO)) {
    out.push({
      key: MISMATCH_KEY, label: 'Document', required: false,
      reason: "This looks like a customer's purchase order - create a Sales Order instead.",
      link: { to: documentRoutes('sales_order').listPath, label: 'Go to Sales Orders' },
    });
  } else {
    const wrong = wrongTypeBadge(warnings);
    if (wrong) doc(`This looks like a ${wrong}, not a ${noun} - check you uploaded the right file.`);
  }
  if (warnings.includes(WARN_CREDIT)) {
    out.push({
      key: MISMATCH_KEY, label: 'Document', required: false,
      reason: 'This looks like a credit (its total is negative) - record it as a vendor credit instead.',
      link: { to: VENDOR_CREDIT_NEW_PATH, label: 'New vendor credit' },
    });
  }
  if ((ex.injection ?? []).length > 0) {
    doc('The document contains text that looks like instructions to an AI assistant. Check every extracted value carefully.');
  }
  return out;
}

/** The review badges shared by both purchase handoffs. */
export function purchaseBadges(ex: ExtractedResult, converted: boolean, notRecognizedLabel: string): HandoffBadges {
  const warnings = ex.warnings ?? [];
  return {
    signed: ex.signed,
    revision: ex.revision?.label ?? '',
    convertedUnits: converted,
    wrongType: wrongTypeBadge(warnings),
    notRecognized: warnings.includes(WARN_NOT_RECOGNIZED),
    notRecognizedLabel,
  };
}
