import { useCallback, useMemo } from 'react';
import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import type { HandoffGeo } from '@/lib/documentAddress';
import { calcLineItem } from '@/lib/purchaseOrderForm';
import { PO_HEADER_KEYS } from '@/lib/purchaseOrderHandoffTypes';
import { createPurchaseOrderAdapter } from './purchaseOrderReviewAdapter';
import { useDocumentReviewMode } from './useDocumentReviewMode';
import type { ReviewLineLike, ReviewLinePatch } from './documentReviewView';
import type { PurchaseOrderReviewForm, PurchaseOrderReviewPatch } from './purchaseReviewTypes';

interface Args {
  form: PurchaseOrderReviewForm;
  /** Writes (part of) the page's form state. */
  apply: (next: PurchaseOrderReviewPatch) => void;
  /** The page's vendor-change handler. */
  onVendorChange: (v: VendorRef | null) => void;
  /** Country/state lookups; the prefill waits for them so states resolve to ids. */
  geo: HandoffGeo | undefined;
}

const NO_TAX_PERCENT = 0;

function signedUsd(raw: unknown): string {
  const n = parseFloat(String(raw ?? '')) || 0;
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

function calcLine(line: ReviewLineLike): { amount: string; total: string } {
  return calcLineItem(line, NO_TAX_PERCENT);
}

/** Everything the Add Purchase Order page needs for "review a document" mode:
 *  the generic review lifecycle with the Purchase Order adapter. Inert
 *  (`active === false`) when the page has no ?fromDocument. */
export function usePurchaseOrderReviewMode({ form, apply, onVendorChange, geo }: Args) {
  const adapter = useMemo(() => createPurchaseOrderAdapter({ geo, onVendorChange }), [geo, onVendorChange]);
  const base = useDocumentReviewMode({ adapter, form, apply });
  const { formTax } = base;

  const updateLine = useCallback((id: string, patch: ReviewLinePatch) => {
    apply({ lineItems: form.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }, [apply, form.lineItems]);

  const fieldValue = useCallback((key: string): string => {
    const { data, vendor } = form;
    switch (key) {
      case PO_HEADER_KEYS.vendor: return vendor?.name ?? '';
      case PO_HEADER_KEYS.referenceNumber: return String(data.reference_number ?? '');
      case PO_HEADER_KEYS.orderDate: return String(data.order_date ?? '');
      case PO_HEADER_KEYS.expectedDate: return String(data.expected_date ?? '');
      case PO_HEADER_KEYS.shipTo:
        return [data.ship_address1, data.ship_city, data.ship_zip].filter(Boolean).join(', ');
      case PO_HEADER_KEYS.shippingCharge: return signedUsd(data.shipping_charge);
      case PO_HEADER_KEYS.adjustment: return signedUsd(data.adjustment);
      case PO_HEADER_KEYS.tax: return signedUsd(formTax);
      default: return '';
    }
  }, [form, formTax]);

  return {
    ...base,
    party: base.handoff?.vendor ?? null,
    formPartyId: form.vendor?.id,
    lineItems: form.lineItems,
    fieldValue,
    calcLine,
    updateLine,
  };
}

/** The review-mode controller returned by usePurchaseOrderReviewMode. */
export type PurchaseOrderReviewMode = ReturnType<typeof usePurchaseOrderReviewMode>;
