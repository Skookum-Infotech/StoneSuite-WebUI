import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';
import { useCustomerRef } from '@/hooks/useCustomerRef';
import { unitCheckItems } from '@/lib/documentReviewState';
import { fillDraftGaps } from '@/lib/salesOrderDraftRefresh';
import {
  buildSalesOrderHandoff, HEADER_KEYS, type HandoffExtras, type HandoffGeo, type SalesOrderHandoff,
} from '@/lib/salesOrderDocumentHandoff';
import { overlayDocumentValues } from '@/lib/salesOrderHandoffMerge';
import { soDefaults } from '@/lib/salesOrderForm';
import { buildCompleteInput, learnedCustomerNote } from '@/lib/salesOrderReviewSave';
import type { SalesOrder, SalesOrderCreatePayload } from '@/types/salesOrder';
import type { DocumentReviewAdapter } from './documentReviewModeTypes';
import type { ReviewForm, ReviewPatch } from './salesOrderReviewTypes';

const ZERO_EXTRAS: HandoffExtras = { expectedDelivery: '', shippingCharge: 0, adjustment: 0 };
const DUPLICATE_MESSAGE = 'A sales order with this PO number already exists for this customer.';

/** The Sales Order adapter for the generic review lifecycle. */
export type SalesOrderReviewAdapter = DocumentReviewAdapter<
  ReviewForm, ReviewPatch, HandoffExtras, SalesOrderHandoff, CustomerRef, SalesOrder, SalesOrderCreatePayload
>;

interface Deps {
  /** Country/state lookups; the handoff waits for them so states resolve to ids. */
  geo: HandoffGeo | undefined;
  apply: (next: ReviewPatch) => void;
  /** The page's customer-change handler (merges the customer's defaults). */
  onCustomerChange: (c: CustomerRef | null) => void;
}

/** Builds the Sales Order adapter. Memoize the result (the generic hook keys
 *  its handoff and effects on the adapter's identity). */
export function createSalesOrderAdapter({ geo, apply, onCustomerChange }: Deps): SalesOrderReviewAdapter {
  return {
    docType: 'sales_order',
    partyReviewKey: HEADER_KEYS.customer,
    duplicateMessage: DUPLICATE_MESSAGE,
    initialExtras: ZERO_EXTRAS,
    buildHandoff: (result, fileName) => (geo ? buildSalesOrderHandoff(result, fileName, geo) : null),
    extrasOf: (h) => h.extras,
    prefill: (h) => ({ data: h.data, lineItems: h.lineItems, customer: h.customer.resolved }),
    mergeDraft: fillDraftGaps,
    toPatch: (form) => form,
    resolvedParty: (h) => h.customer.resolved,
    formParty: (form) => form.customer,
    usePartyRecord: useCustomerRef,
    applyParty: (customer, h) => {
      onCustomerChange(customer);
      if (customer && h) apply({ data: (d) => overlayDocumentValues(d, h.data, soDefaults()) });
    },
    lineHasItem: (form, lineId) => {
      const li = form.lineItems.find((l) => l.id === lineId);
      return li ? Boolean(li.inventoryItemUuid) : undefined;
    },
    lineStats: (form) => ({
      amounts: new Map(form.lineItems.map((l) => [l.id, parseFloat(l.amount) || 0])),
      tax: form.lineItems.reduce((s, l) => s + (parseFloat(l.total) || 0) - (parseFloat(l.amount) || 0), 0),
    }),
    unitChecks: (h, form) => unitCheckItems(h.lines, form.lineItems),
    extrasAmount: (e) => e.shippingCharge + e.adjustment,
    payloadExtras: (e, allowDuplicate) => ({
      ...(e.expectedDelivery ? { expectedDelivery: e.expectedDelivery } : {}),
      shippingCharge: e.shippingCharge,
      adjustment: e.adjustment,
      ...(allowDuplicate ? { allowDuplicate: true } : {}),
    }),
    completeInput: (order, form, h) => buildCompleteInput(
      order.id,
      {
        customerUuid: form.customer?.id ?? '',
        poNumber: String(form.data.purchase_doc_num ?? ''),
        orderDate: String(form.data.date_created ?? ''),
      },
      h.lines, form.lineItems,
    ),
    createdSummary: (order, form, h, fileName) => ({
      recordId: order.id,
      title: `Sales Order ${order.salesOrderNumber} created from ${fileName}`,
      description: learnedCustomerNote(h, form.customer) || undefined,
    }),
  };
}
