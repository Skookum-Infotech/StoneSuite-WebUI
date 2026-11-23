import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { unitCheckItems } from '@/lib/documentReviewState';
import { savedLines } from '@/lib/documentHandoffShared';
import { fillPurchaseDraftGaps, learnedVendorNote } from '@/lib/purchaseReviewSave';
import { buildVendorBillHandoff, type VendorBillHandoff } from '@/lib/vendorBillDocumentHandoff';
import { VB_HEADER_KEYS } from '@/lib/vendorBillHandoffTypes';
import type { CreateVendorBillPayload, VendorBill } from '@/types/vendorBill';
import type { DocumentReviewAdapter } from './documentReviewModeTypes';
import type { NoExtras, VendorBillReviewForm, VendorBillReviewPatch } from './purchaseReviewTypes';

const NO_EXTRAS: NoExtras = {};
const DUPLICATE_MESSAGE = 'A bill with this vendor invoice number already exists for this vendor.';

/** The Vendor Bill adapter for the generic review lifecycle. */
export type VendorBillReviewAdapter = DocumentReviewAdapter<
  VendorBillReviewForm, VendorBillReviewPatch, NoExtras, VendorBillHandoff, VendorRef, VendorBill, CreateVendorBillPayload
>;

interface Deps {
  /** The page's vendor-change handler (drops a PO link that belongs to another vendor). */
  onVendorChange: (v: VendorRef | null) => void;
}

/** Builds the Vendor Bill adapter. Memoize the result. A vendor record carries
 *  no defaults to merge, so picking one only sets it; the document's own values
 *  (terms, dates, number) are untouched. */
export function createVendorBillAdapter({ onVendorChange }: Deps): VendorBillReviewAdapter {
  return {
    docType: 'vendor_bill',
    partyReviewKey: VB_HEADER_KEYS.vendor,
    duplicateMessage: DUPLICATE_MESSAGE,
    initialExtras: NO_EXTRAS,
    buildHandoff: (result, fileName) => buildVendorBillHandoff(result, fileName),
    extrasOf: () => NO_EXTRAS,
    prefill: (h) => ({ data: h.data, lineItems: h.lineItems, vendor: h.vendor.resolved, purchaseOrder: h.purchaseOrder.ref }),
    mergeDraft: (draft, h) => ({ ...fillPurchaseDraftGaps(draft, h), purchaseOrder: draft.purchaseOrder }),
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
    extrasAmount: (_extras, form) => parseFloat(String(form.data.adjustment ?? '')) || 0,
    payloadExtras: (_extras, allowDuplicate) => (allowDuplicate ? { allowDuplicate: true } : {}),
    completeInput: (bill, form, h) => ({
      recordUuid: bill.id,
      saved: {
        vendorUuid: form.vendor?.id ?? '',
        invoiceNumber: String(form.data.vendor_invoice_number ?? ''),
        invoiceDate: String(form.data.bill_date ?? ''),
        poNumber: form.purchaseOrder?.number ?? String(form.data.reference_number ?? ''),
        lines: savedLines(h.lines, form.lineItems),
      },
    }),
    createdSummary: (bill, form, h, fileName) => ({
      recordId: bill.id,
      title: `Vendor Bill ${bill.vendorBillNumber} created from ${fileName}`,
      description: learnedVendorNote(h.vendor, form.vendor) || undefined,
    }),
  };
}
