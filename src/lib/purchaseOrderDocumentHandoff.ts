import { applyAddress, NO_GEO, type HandoffGeo } from '@/lib/documentAddress';
import type { ProvenanceInfo, ReviewItem } from '@/lib/documentHandoffShared';
import {
  buildPurchaseLines, buildVendor, documentWarningItems, lowConfidenceItem, preTaxTotal, purchaseBadges, purchaseTaxItem,
} from '@/lib/purchaseDocumentShared';
import { PO_HEADER_KEYS, PO_HEADER_LABELS, type PurchaseOrderHandoff } from '@/lib/purchaseOrderHandoffTypes';
import { calcLineItem, purchaseOrderDefaults, type PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';
import { money, noteFor, parseMoney, provenanceOf, toIsoDate } from '@/lib/salesOrderDocumentHandoff';
import type { ExtractedField, ExtractionResultDoc } from '@/types/documentExtraction';

export type { PurchaseOrderHandoff } from '@/lib/purchaseOrderHandoffTypes';

const NOT_RECOGNIZED_LABEL = 'Not a purchase order?';
const NO_TAX_PERCENT = 0;

/** Maps a ready extraction onto the Add Purchase Order form's state and review
 *  metadata. The document may be a vendor's quote, our own PO from another
 *  system, or a builder's order form (no prices; the builder goes in the notes). */
export function buildPurchaseOrderHandoff(doc: ExtractionResultDoc, fileName: string, geo: HandoffGeo = NO_GEO): PurchaseOrderHandoff {
  const { extracted: ex, resolution: res } = doc;
  const h = ex.header;
  const K = PO_HEADER_KEYS;
  const provenance: Record<string, ProvenanceInfo> = {};
  const reviewItems: ReviewItem[] = [];
  const data: Record<string, unknown> = { ...purchaseOrderDefaults() };

  const vendor = buildVendor(res, h.vendorName, K.vendor, PO_HEADER_LABELS.vendor);
  provenance[K.vendor] = vendor.provenance;
  if (vendor.item) reviewItems.push(vendor.item);

  const simple: Array<[string, ExtractedField]> = [
    [K.referenceNumber, h.poNumber], [K.orderDate, h.orderDate], [K.expectedDate, h.deliveryDate],
    [K.paymentTerms, h.paymentTerms], [K.shipTo, h.shipTo], [K.shippingCharge, h.shipping], [K.adjustment, h.discount],
  ];
  simple.forEach(([key, f]) => {
    if (f.value) provenance[key] = provenanceOf(f);
    const flag = lowConfidenceItem(key, PO_HEADER_LABELS[key], f);
    if (flag) reviewItems.push(flag);
  });

  if (h.poNumber.value) data.reference_number = h.poNumber.value;
  const orderDate = toIsoDate(h.orderDate.value);
  if (orderDate) data.order_date = orderDate;
  else if (h.orderDate.value) {
    reviewItems.push({ key: K.orderDate, label: PO_HEADER_LABELS.orderDate, required: false, reason: `Couldn't read the date "${h.orderDate.value}" - check it.` });
  }
  const expected = toIsoDate(h.deliveryDate.value);
  if (expected) data.expected_date = expected;
  else if (h.deliveryDate.value) {
    reviewItems.push({ key: K.expectedDate, label: PO_HEADER_LABELS.expectedDate, required: false, reason: `Couldn't read the date "${h.deliveryDate.value}" - check it.` });
  }
  if (res.paymentTerms) {
    data.payment_terms = String(res.paymentTerms.id);
    provenance[K.paymentTerms] = { ...(provenance[K.paymentTerms] ?? { source: 'document', confidence: 'high' }), source: 'catalog' };
  } else if (h.paymentTerms.value) {
    reviewItems.push({ key: K.paymentTerms, label: PO_HEADER_LABELS.paymentTerms, required: false, reason: `Terms "${h.paymentTerms.value}" didn't match a payment term - choose one.` });
  }
  // The document's ship-to is where the goods go (an order form's install address).
  if (h.shipTo.value) applyAddress(data, reviewItems, 'ship', h.shipTo.value, h.customerName.value, geo);

  data.memo = [noteFor(fileName, ex.revision), h.notes?.value].filter(Boolean).join('\n\n');
  const shipping = parseMoney(h.shipping.value);
  const discount = parseMoney(h.discount.value);
  if (shipping !== null) data.shipping_charge = money(Math.abs(shipping));
  if (discount !== null && discount !== 0) data.adjustment = money(-Math.abs(discount));

  const built = buildPurchaseLines(ex, res);
  Object.assign(provenance, built.provenance);
  reviewItems.push(...built.reviewItems);
  const lineItems: PurchaseOrderLineItem[] = built.fields.map((f) => ({
    ...f, ...calcLineItem(f, NO_TAX_PERCENT),
  }));

  const { docTotal, docTax } = preTaxTotal(h.total, h.tax);
  const taxCheck = purchaseTaxItem(K.tax, PO_HEADER_LABELS.tax, 'purchase order', docTax, parseMoney(h.subtotal.value));
  if (taxCheck) {
    reviewItems.push(taxCheck);
    provenance[K.tax] = provenanceOf(h.tax);
  }
  reviewItems.push(...documentWarningItems('purchase_order', ex, lineItems.length === 0));

  return {
    vendor: vendor.party, data, lineItems, lines: built.lines, provenance, reviewItems, docTotal, docTax,
    badges: purchaseBadges(ex, built.convertedUnits, NOT_RECOGNIZED_LABEL),
  };
}
