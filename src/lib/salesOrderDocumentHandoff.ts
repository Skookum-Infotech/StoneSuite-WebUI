import { calcLineItem, EMPTY_LINE_ITEM, soDefaults, type SOLineItem } from '@/lib/salesOrderForm';
import type { ExtractedField, ExtractedLine, ExtractionResultDoc, LineMatch } from '@/types/documentExtraction';
import { applyAddress, NO_GEO, type HandoffGeo } from '@/lib/documentAddress';

// Pure mapping from a ready extraction to the Add Sales Order form's own state
// shapes (form `data` keys, SOLineItem rows), plus the review metadata the
// split-pane review screen needs: per-field provenance, per-line status pills
// and the checklist of things the reviewer still has to resolve.

const MILLI = 1000;
const CENTS = 100;
const WRONG_TYPE_PREFIX = 'document_looks_like_';
const WARN_NOT_RECOGNIZED = 'document_not_recognized';
const WARN_NO_LINE_TABLE = 'no_line_table';
const WARN_MISSING_PO = 'missing_po_number';
/** Markers that introduce an add-on row on a PO ("+ Sink cutout", "w/ Installation"). */
const ADDON_MARKER = /^\s*(?:\+|w\/|with\s|add\s)\s*/i;
const LINE_FLAG_PRICE_DIFFERS = 'price_differs_from_catalog';
const LINE_FLAG_INACTIVE = 'item_inactive';
const US_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export * from './salesOrderHandoffTypes';
export type { HandoffGeo } from '@/lib/documentAddress';
import {
  HEADER_KEYS, HEADER_LABELS, docLineId, lineReviewKey,
  type HandoffExtras, type HandoffLine, type LinePill, type ProvenanceInfo, type ReviewItem, type SalesOrderHandoff,
} from './salesOrderHandoffTypes';

/** Parses "$1,234.50" / "(12.00)" / "-12" into a number; NaN-safe (returns null). */
export function parseMoney(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Normalises a document date to yyyy-mm-dd; '' when it can't be read safely. */
export function toIsoDate(raw: string): string {
  const s = raw.trim();
  if (ISO_DATE.test(s)) return s;
  const m = US_DATE.exec(s);
  if (!m) return '';
  const [, mo, d, y] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function provenanceOf(f: ExtractedField): ProvenanceInfo {
  return { value: f.value, source: f.source, confidence: f.confidence, snippet: f.snippet, page: f.page, row: f.row };
}


function money(n: number): string {
  return n.toFixed(2);
}

/** Add-ons follow their parent; a product's add-ons keep document order. */
function orderLines(lines: ExtractedLine[]): number[] {
  const out: number[] = [];
  const children = new Map<number, number[]>();
  const validParent = (l: ExtractedLine): boolean =>
    l.kind === 'addon' && l.parentLine !== undefined && l.parentLine >= 1 && l.parentLine <= lines.length
    && lines[l.parentLine - 1].kind === 'product';
  lines.forEach((l, i) => {
    if (validParent(l)) {
      const list = children.get(l.parentLine as number) ?? [];
      list.push(i);
      children.set(l.parentLine as number, list);
    }
  });
  lines.forEach((l, i) => {
    if (l.kind !== 'product' && l.kind !== 'addon') return;
    if (validParent(l)) return;
    out.push(i);
    (children.get(i + 1) ?? []).forEach((c) => out.push(c));
  });
  return out;
}

/** An add-on's text without its "+ " / "w/ " marker; other lines unchanged. */
export function stripAddonMarker(text: string, kind: ExtractedLine['kind']): string {
  return kind === 'addon' ? text.replace(ADDON_MARKER, '').trim() || text : text;
}

function lineDocText(l: ExtractedLine): string {
  return [l.sku.value, l.description.value].filter(Boolean).join(' - ');
}

interface BuiltLine {
  item: SOLineItem;
  meta: HandoffLine;
  review: ReviewItem[];
  converted: boolean;
}

function buildLine(
  l: ExtractedLine, docIndex: number, lineNo: number, match: LineMatch | undefined, parentLineNo: number | undefined,
): BuiltLine {
  const item = match?.item;
  const conv = match?.converted;
  const qty = (conv ? conv.qtyMilli : l.qtyMilli) / MILLI;
  const price = (conv ? conv.unitPriceCents : l.unitPriceCents) / CENTS;
  const usable = item !== undefined && item.active && !match?.flags?.includes(LINE_FLAG_INACTIVE);
  const learned = match?.source === 'learned';
  const pills: LinePill[] = [];
  const review: ReviewItem[] = [];
  const key = lineReviewKey(lineNo);
  const text = lineDocText(l);

  if (parentLineNo) pills.push({ kind: 'addon', label: `Add-on to line ${parentLineNo}` });
  if (!usable) {
    pills.push({ kind: 'pick_item', label: 'Pick item' });
    const reason = item && !item.active ? 'The matched item is inactive - pick an active item.' : 'No inventory item matched - pick one.';
    review.push({ key, label: `Line ${lineNo}`, reason, required: true });
  } else {
    pills.push(learned ? { kind: 'learned', label: 'Learned' } : { kind: 'matched', label: 'Matched' });
    const catalog = item.catalogPriceCents;
    if (Math.round(price * CENTS) !== catalog) {
      pills.push({ kind: 'price_differs', label: `Price ≠ catalog $${money(catalog / CENTS)}` });
      review.push({ key, label: `Line ${lineNo}`, reason: `Document price differs from the catalog price ($${money(catalog / CENTS)}).`, required: false });
    }
  }
  let conversionNote: string | undefined;
  if (conv) {
    conversionNote = `Converted ${conv.fromQtyMilli / MILLI} ${conv.fromUom} to ${qty} ${conv.toUom}`;
    pills.push({ kind: 'converted', label: 'Unit converted' });
    review.push({ key, label: `Line ${lineNo}`, reason: conversionNote, required: false });
  }
  const extraFlags = (l.flags ?? []).concat(match?.flags ?? []).filter((f) => f !== LINE_FLAG_PRICE_DIFFERS && f !== LINE_FLAG_INACTIVE);
  if (extraFlags.length > 0 && usable) {
    review.push({ key, label: `Line ${lineNo}`, reason: `Check this line (${extraFlags.join(', ')}).`, required: false });
  }

  const base = {
    ...EMPTY_LINE_ITEM,
    quantity: String(qty),
    unitPrice: money(price),
  };
  const description = stripAddonMarker(l.description.value, l.kind);
  const row = usable
    ? { ...base, itemName: item.name, itemSku: item.sku, itemDescription: description, units: item.unitCode, inventoryItemUuid: item.uuid }
    : { ...base, itemName: description || l.sku.value, itemSku: l.sku.value, itemDescription: description, units: l.uom.value };
  const calc = calcLineItem(row);
  return {
    item: { ...row, ...calc, id: docLineId(docIndex), lineNo },
    meta: {
      id: docLineId(docIndex), docIndex, lineNo, docSku: l.sku.value, docDescription: l.description.value, docText: text,
      docAmount: l.amount.value ? l.amountCents / CENTS : null, parentLineNo, pills, requiresItem: !usable, conversionNote,
      docUom: conv ? conv.toUom : l.uom.value, docQty: conv || l.qty.value ? qty : null,
    },
    review,
    converted: conv !== undefined,
  };
}

function noteFor(fileName: string, revision?: { label: string; referencedNumber?: string }): string {
  const rev = revision ? ` ${revision.label}${revision.referencedNumber ? ` (references ${revision.referencedNumber})` : ''}.` : '';
  return `Created from document ${fileName}.${rev}`;
}

function headerFlag(items: ReviewItem[], key: string, f: ExtractedField): void {
  if (!f.value) return;
  if (f.confidence === 'check' || f.confidence === 'not_found') {
    items.push({ key, label: HEADER_LABELS[key], reason: 'Confidence is low - check this value against the document.', required: false });
  }
}

/** StoneSuite computes tax from the Sales Tax %, never from the document, so a
 *  document that charges tax gets a required check quoting the implied rate:
 *  without it an order silently saves without the PO's tax. */
export function taxReviewItem(docTax: number, docSubtotal: number | null): ReviewItem | null {
  if (docTax <= 0) return null;
  const rate = docSubtotal && docSubtotal > 0 ? Math.round((docTax / docSubtotal) * 100 * MILLI) / MILLI : null;
  const implied = rate === null ? '' : ` (about ${rate}% of the subtotal)`;
  return {
    key: HEADER_KEYS.tax, label: HEADER_LABELS.tax, required: true, resolvedByReview: true,
    reason: `The document charges $${money(docTax)} tax${implied}. Set the lines' Tax % so the order charges the same tax, then mark it reviewed.`,
  };
}

/** Maps a ready extraction onto the Add Sales Order form's state and review metadata. */
export function buildSalesOrderHandoff(doc: ExtractionResultDoc, fileName: string, geo: HandoffGeo = NO_GEO): SalesOrderHandoff {
  const { extracted: ex, resolution: res } = doc;
  const h = ex.header;
  const provenance: Record<string, ProvenanceInfo> = {};
  const reviewItems: ReviewItem[] = [];
  const data: Record<string, unknown> = { ...soDefaults() };

  // Customer: resolved uuid, or unresolved with candidates + the extracted text.
  const cust = res.customer;
  const inactive = Boolean(cust.uuid) && !cust.active;
  const resolved = cust.uuid && cust.active ? { id: cust.uuid, name: cust.name ?? h.customerName.value } : null;
  provenance[HEADER_KEYS.customer] = { ...provenanceOf(h.customerName), source: cust.source, confidence: cust.confidence };
  if (!resolved) {
    reviewItems.push({
      key: HEADER_KEYS.customer, label: HEADER_LABELS.customer, required: true,
      reason: inactive
        ? `${cust.name ?? 'The matched customer'} is not active - pick another customer.`
        : 'Customer not matched - pick one.',
    });
  } else if (cust.confidence !== 'high') {
    reviewItems.push({ key: HEADER_KEYS.customer, label: HEADER_LABELS.customer, required: false, reason: 'Check the matched customer.' });
  }

  const simple: Array<[string, ExtractedField]> = [
    [HEADER_KEYS.poNumber, h.poNumber],
    [HEADER_KEYS.orderDate, h.orderDate],
    [HEADER_KEYS.expectedDelivery, h.deliveryDate],
    [HEADER_KEYS.paymentTerms, h.paymentTerms],
    [HEADER_KEYS.billTo, h.billTo],
    [HEADER_KEYS.shipTo, h.shipTo],
    [HEADER_KEYS.shippingCharge, h.shipping],
    [HEADER_KEYS.adjustment, h.discount],
  ];
  simple.forEach(([key, f]) => {
    if (f.value) provenance[key] = provenanceOf(f);
    headerFlag(reviewItems, key, f);
  });

  if (h.poNumber.value) data.purchase_doc_num = h.poNumber.value;
  const orderDate = toIsoDate(h.orderDate.value);
  if (orderDate) data.date_created = orderDate;
  else if (h.orderDate.value) {
    reviewItems.push({ key: HEADER_KEYS.orderDate, label: HEADER_LABELS.orderDate, required: false, reason: `Couldn't read the date "${h.orderDate.value}" - check it.` });
  }
  if (res.paymentTerms) {
    data.payment_terms = String(res.paymentTerms.id);
    provenance[HEADER_KEYS.paymentTerms] = { ...(provenance[HEADER_KEYS.paymentTerms] ?? { source: 'document', confidence: 'high' }), source: 'catalog' };
  } else if (h.paymentTerms.value) {
    reviewItems.push({ key: HEADER_KEYS.paymentTerms, label: HEADER_LABELS.paymentTerms, required: false, reason: `Terms "${h.paymentTerms.value}" didn't match a payment term - choose one.` });
  }
  if (h.billTo.value) applyAddress(data, reviewItems, 'bill', h.billTo.value, h.customerName.value, geo);
  if (h.shipTo.value) {
    data.ship_same_as_bill = false;
    applyAddress(data, reviewItems, 'ship', h.shipTo.value, h.customerName.value, geo);
  }
  data.memo = noteFor(fileName, ex.revision);

  const shipping = parseMoney(h.shipping.value);
  const discount = parseMoney(h.discount.value);
  const extras: HandoffExtras = {
    expectedDelivery: toIsoDate(h.deliveryDate.value),
    shippingCharge: shipping === null ? 0 : Math.abs(shipping),
    // A document discount is a deduction; the form's adjustment is signed.
    adjustment: discount === null || discount === 0 ? 0 : -Math.abs(discount),
  };

  // Lines. Results stored before the backend stopped emitting null lists may
  // carry `lines: null`, so both lists are guarded.
  const exLines = ex.lines ?? [];
  const matches = new Map<number, LineMatch>((res.lines ?? []).map((m) => [m.index, m]));
  const order = orderLines(exLines);
  const lineNoByDoc = new Map<number, number>(order.map((docIndex, i) => [docIndex, i + 1]));
  const lineItems: SOLineItem[] = [];
  const lines: HandoffLine[] = [];
  let convertedUnits = false;
  order.forEach((docIndex) => {
    const l = exLines[docIndex];
    const lineNo = lineNoByDoc.get(docIndex) as number;
    const parentLineNo = l.kind === 'addon' && l.parentLine ? lineNoByDoc.get(l.parentLine - 1) : undefined;
    const built = buildLine(l, docIndex, lineNo, matches.get(docIndex), parentLineNo);
    lineItems.push(built.item);
    lines.push(built.meta);
    reviewItems.push(...built.review);
    convertedUnits ||= built.converted;
    provenance[lineReviewKey(lineNo)] = provenanceOf(l.description.value ? l.description : l.sku);
  });

  const rawTotal = parseMoney(h.total.value);
  const docTax = parseMoney(h.tax.value) ?? 0;
  const total = rawTotal === null ? null : Math.round((rawTotal - docTax) * CENTS) / CENTS;
  const taxCheck = taxReviewItem(docTax, parseMoney(h.subtotal.value));
  if (taxCheck) {
    reviewItems.push(taxCheck);
    provenance[HEADER_KEYS.tax] = provenanceOf(h.tax);
  }
  const warnings = ex.warnings ?? [];
  const wrong = warnings.find((w) => w.startsWith(WRONG_TYPE_PREFIX));
  const notRecognized = warnings.includes(WARN_NOT_RECOGNIZED);
  if (notRecognized) {
    reviewItems.push({ key: 'document', label: 'Document', required: false, reason: "This doesn't look like a purchase order - no item table, PO number or customer was found. Check you uploaded the right file." });
  } else if (warnings.includes(WARN_NO_LINE_TABLE) && order.length === 0) {
    reviewItems.push({ key: 'document', label: 'Document', required: false, reason: 'No item table was found in the document - add the lines below by hand.' });
  }
  if (warnings.includes(WARN_MISSING_PO) && !h.poNumber.value) {
    reviewItems.push({ key: HEADER_KEYS.poNumber, label: HEADER_LABELS.poNumber, required: false, reason: 'No PO number was found in the document - enter it if the customer gave one.' });
  }
  const injected = (ex.injection ?? []).length > 0;
  if (injected) {
    reviewItems.push({ key: 'document', label: 'Document', required: false, reason: 'The document contains text that looks like instructions to an AI assistant. Check every extracted value carefully.' });
  }

  return {
    customer: { resolved, extractedText: h.customerName.value, candidates: cust.candidates ?? [], inactive },
    data, extras, lineItems, lines, provenance, reviewItems,
    docTotal: total,
    docTax,
    badges: {
      signed: ex.signed,
      revision: ex.revision?.label ?? '',
      convertedUnits,
      wrongType: wrong ? wrong.slice(WRONG_TYPE_PREFIX.length).replace(/_/g, ' ') : '',
      notRecognized,
    },
  };
}
