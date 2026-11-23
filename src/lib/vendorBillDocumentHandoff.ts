import type { ProvenanceInfo, ReviewItem } from '@/lib/documentHandoffShared';
import {
  buildPurchaseLines, buildVendor, documentWarningItems, lowConfidenceItem, preTaxTotal, purchaseBadges, purchaseTaxItem,
} from '@/lib/purchaseDocumentShared';
import { money, noteFor, parseMoney, provenanceOf, toIsoDate } from '@/lib/salesOrderDocumentHandoff';
import { buildPoLink } from '@/lib/vendorBillPoLink';
import { calcLineItem, vendorBillDefaults, type VendorBillLineItem } from '@/lib/vendorBillForm';
import { VB_HEADER_KEYS, VB_HEADER_LABELS, type VendorBillHandoff } from '@/lib/vendorBillHandoffTypes';
import type { ExtractedField, ExtractionResultDoc } from '@/types/documentExtraction';

export type { VendorBillHandoff } from '@/lib/vendorBillHandoffTypes';

const NOT_RECOGNIZED_LABEL = 'Not a vendor bill?';
const NO_TAX_PERCENT = 0;
const WARN_MISSING_NUMBER = 'missing_invoice_number';
const WARN_MISSING_DATE = 'missing_invoice_date';
const WARN_DUE_FROM_TERMS = 'due_date_from_terms';

function note(key: string, reason: string): ReviewItem {
  return { key, label: VB_HEADER_LABELS[key], required: false, reason };
}

/** Maps a ready extraction onto the Add Vendor Bill form's state and review
 *  metadata. Lines and prices always come from the bill itself; the linked
 *  purchase order only supplies which order line each bill line is billed
 *  against. */
export function buildVendorBillHandoff(doc: ExtractionResultDoc, fileName: string): VendorBillHandoff {
  const { extracted: ex, resolution: res } = doc;
  const h = ex.header;
  const K = VB_HEADER_KEYS;
  const warnings = ex.warnings ?? [];
  const provenance: Record<string, ProvenanceInfo> = {};
  const reviewItems: ReviewItem[] = [];
  const data: Record<string, unknown> = { ...vendorBillDefaults() };

  const vendor = buildVendor(res, h.vendorName, K.vendor, VB_HEADER_LABELS.vendor);
  provenance[K.vendor] = vendor.provenance;
  if (vendor.item) reviewItems.push(vendor.item);

  const invoiceNumber = h.invoiceNumber as ExtractedField | undefined;
  const invoiceDate = h.invoiceDate as ExtractedField | undefined;
  const dueDate = h.dueDate as ExtractedField | undefined;
  const dueFromTerms = warnings.includes(WARN_DUE_FROM_TERMS);
  const simple: Array<[string, ExtractedField | undefined]> = [
    [K.invoiceNumber, invoiceNumber], [K.billDate, invoiceDate], [K.dueDate, dueDate],
    [K.paymentTerms, h.paymentTerms], [K.adjustment, h.discount],
  ];
  simple.forEach(([key, f]) => {
    if (!f) return;
    if (f.value) provenance[key] = provenanceOf(f);
    const flag = key === K.dueDate && dueFromTerms ? null : lowConfidenceItem(key, VB_HEADER_LABELS[key], f);
    if (flag) reviewItems.push(flag);
  });

  if (invoiceNumber?.value) data.vendor_invoice_number = invoiceNumber.value;
  else if (warnings.includes(WARN_MISSING_NUMBER)) {
    reviewItems.push(note(K.invoiceNumber, "No vendor invoice number was found - enter it; it is how a bill entered twice is caught."));
  }
  const billDate = toIsoDate(invoiceDate?.value ?? '');
  if (billDate) data.bill_date = billDate;
  else if (invoiceDate?.value) reviewItems.push(note(K.billDate, `Couldn't read the date "${invoiceDate.value}" - check it.`));
  else if (warnings.includes(WARN_MISSING_DATE)) reviewItems.push(note(K.billDate, 'No invoice date was found - the bill date is today; check it.'));
  const due = toIsoDate(dueDate?.value ?? '');
  if (due) data.due_date = due;
  else if (dueDate?.value) reviewItems.push(note(K.dueDate, `Couldn't read the date "${dueDate.value}" - check it.`));
  if (due && dueFromTerms) reviewItems.push(note(K.dueDate, 'Computed from the payment terms - check it against the bill.'));
  if (due && billDate && due < billDate) reviewItems.push(note(K.dueDate, 'The due date is before the bill date - check both.'));

  if (res.paymentTerms) {
    data.payment_terms = String(res.paymentTerms.id);
    provenance[K.paymentTerms] = { ...(provenance[K.paymentTerms] ?? { source: 'document', confidence: 'high' }), source: 'catalog' };
  } else if (h.paymentTerms.value) {
    reviewItems.push(note(K.paymentTerms, `Terms "${h.paymentTerms.value}" didn't match a payment term - choose one.`));
  }
  if (h.poNumber.value) data.reference_number = h.poNumber.value;
  data.memo = [noteFor(fileName, ex.revision), h.notes?.value].filter(Boolean).join('\n\n');

  // A bill has one signed adjustment: freight adds to it, a discount takes from it.
  const shipping = parseMoney(h.shipping.value) ?? 0;
  const discount = parseMoney(h.discount.value) ?? 0;
  const adjustment = Math.abs(shipping) - Math.abs(discount);
  if (adjustment !== 0) data.adjustment = money(adjustment);
  if (shipping !== 0) {
    if (!provenance[K.adjustment]) provenance[K.adjustment] = provenanceOf(h.shipping);
    reviewItems.push(note(K.adjustment, `Freight of $${money(Math.abs(shipping))} was added to the adjustment.`));
  }

  const built = buildPurchaseLines(ex, res);
  Object.assign(provenance, built.provenance);
  reviewItems.push(...built.reviewItems);
  const po = buildPoLink(res, res.vendor, built.fields, h.poNumber.value);
  reviewItems.push(...po.items);
  if (po.link.ref) provenance[K.purchaseOrder] = provenanceOf(h.poNumber.value ? h.poNumber : { ...h.poNumber, value: po.link.ref.number });
  const lineItems: VendorBillLineItem[] = built.fields.map((f) => ({
    ...f, ...calcLineItem(f, NO_TAX_PERCENT),
    ...(po.linking.links[f.id] ? { purchaseOrderItemId: po.linking.links[f.id] } : {}),
  }));

  const { docTotal, docTax } = preTaxTotal(h.total, h.tax);
  const taxCheck = purchaseTaxItem(K.tax, VB_HEADER_LABELS.tax, 'bill', docTax, parseMoney(h.subtotal.value));
  if (taxCheck) {
    reviewItems.push(taxCheck);
    provenance[K.tax] = provenanceOf(h.tax);
  }
  reviewItems.push(...documentWarningItems('vendor_bill', ex, lineItems.length === 0));

  return {
    vendor: vendor.party, data, lineItems, purchaseOrder: po.link, lines: built.lines, provenance, reviewItems,
    docTotal, docTax, badges: purchaseBadges(ex, built.convertedUnits, NOT_RECOGNIZED_LABEL),
  };
}
