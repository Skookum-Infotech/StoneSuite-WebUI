import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { unitCheckItems } from '@/lib/documentReviewState';
import type { HandoffGeo } from '@/lib/documentAddress';
import { buildPurchaseOrderHandoff, type PurchaseOrderHandoff } from '@/lib/purchaseOrderDocumentHandoff';
import { PO_HEADER_KEYS } from '@/lib/purchaseOrderHandoffTypes';
import { savedLines } from '@/lib/documentHandoffShared';
import { fillPurchaseDraftGaps, learnedVendorNote } from '@/lib/purchaseReviewSave';
import type { PurchaseOrder, PurchaseOrderCreatePayload } from '@/types/purchaseOrder';
import type { DocumentReviewAdapter } from './documentReviewModeTypes';
import type { NoExtras, PurchaseOrderReviewForm, PurchaseOrderReviewPatch } from './purchaseReviewTypes';

const NO_EXTRAS: NoExtras = {};
const DUPLICATE_MESSAGE = 'A purchase order with this reference number already exists for this vendor.';

/** The Purchase Order adapter for the generic review lifecycle. */
export type PurchaseOrderReviewAdapter = DocumentReviewAdapter<
  PurchaseOrderReviewForm, PurchaseOrderReviewPatch, NoExtras, PurchaseOrderHandoff, VendorRef, PurchaseOrder, PurchaseOrderCreatePayload
>;

interface Deps {
  /** Country/state lookups; the handoff waits for them so ship-to states resolve to ids. */
  geo: HandoffGeo | undefined;
  /** The page's vendor-change handler. */
  onVendorChange: (v: VendorRef | null) => void;
}

const num = (v: unknown): number => parseFloat(String(v ?? '')) || 0;

/** Builds the Purchase Order adapter. Memoize the result (the generic hook keys
 *  its handoff and effects on the adapter's identity). A vendor record carries
 *  no defaults to merge, so picking one only sets it; the document's values
 *  stay as they are. */
export function createPurchaseOrderAdapter({ geo, onVendorChange }: Deps): PurchaseOrderReviewAdapter {
  return {
    docType: 'purchase_order',
    partyReviewKey: PO_HEADER_KEYS.vendor,
    duplicateMessage: DUPLICATE_MESSAGE,
    initialExtras: NO_EXTRAS,
    buildHandoff: (result, fileName) => (geo ? buildPurchaseOrderHandoff(result, fileName, geo) : null),
    extrasOf: () => NO_EXTRAS,
    prefill: (h) => ({ data: h.data, lineItems: h.lineItems, vendor: h.vendor.resolved }),
    mergeDraft: fillPurchaseDraftGaps,
    toPatch: (form) => form,
    resolvedParty: (h) => h.vendor.resolved,
    formParty: (form) => form.vendor,
    usePartyRecord: () => ({ data: undefined }),
    applyParty: (vendor) => onVendorChange(vendor),
    lineHasItem: (form, lineId) => {
      const li = form.lineItems.find((l) => l.id === lineId);
      return li ? Boolean(li.inventoryItemUuid) : undefined;
    },
    lineStats: (form) => ({
      amounts: new Map(form.lineItems.map((l) => [l.id, parseFloat(l.amount) || 0])),
      tax: form.lineItems.reduce((s, l) => s + (parseFloat(l.total) || 0) - (parseFloat(l.amount) || 0), 0),
    }),
    unitChecks: (h, form) => unitCheckItems(h.lines, form.lineItems),
    extrasAmount: (_extras, form) => num(form.data.shipping_charge) + num(form.data.adjustment),
    payloadExtras: () => ({}),
    completeInput: (po, form, h) => ({
      recordUuid: po.id,
      saved: {
        vendorUuid: form.vendor?.id ?? '',
        poNumber: String(form.data.reference_number ?? ''),
        orderDate: String(form.data.order_date ?? ''),
        lines: savedLines(h.lines, form.lineItems),
      },
    }),
    createdSummary: (po, form, h, fileName) => ({
      recordId: po.id,
      title: `Purchase Order ${po.purchaseOrderNumber} created from ${fileName}`,
      description: learnedVendorNote(h.vendor, form.vendor) || undefined,
    }),
  };
}
