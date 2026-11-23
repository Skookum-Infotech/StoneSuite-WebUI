import { useCallback, useMemo } from 'react';
import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';
import type { HandoffGeo } from '@/lib/salesOrderDocumentHandoff';
import type { DuplicateConflict } from '@/lib/salesOrderDuplicate';
import { calcLineItem, type SOLineItem } from '@/lib/salesOrderForm';
import { HEADER_KEYS } from '@/lib/salesOrderDocumentHandoff';
import { createSalesOrderAdapter } from './salesOrderReviewAdapter';
import { useDocumentReviewMode } from './useDocumentReviewMode';
import type { DocFocus, ReviewForm, ReviewPatch } from './salesOrderReviewTypes';
import type { ReviewLineLike } from './documentReviewView';

export type { DocFocus, ReviewForm, ReviewPatch };

function signedUsd(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

interface Args {
  form: ReviewForm;
  /** Writes (part of) the page's form state. */
  apply: (next: ReviewPatch) => void;
  /** The page's customer-change handler (merges the customer's defaults). */
  onCustomerChange: (c: CustomerRef | null) => void;
  /** Country/state lookups; the prefill waits for them so states resolve to ids. */
  geo: HandoffGeo | undefined;
}

/** Everything the Add Sales Order page needs for "review a document" mode:
 *  the generic review lifecycle (useDocumentReviewMode) with the Sales Order
 *  adapter. Inert (`active === false`) when the page has no ?fromDocument. */
export function useSalesOrderReviewMode({ form, apply, onCustomerChange, geo }: Args) {
  const adapter = useMemo(
    () => createSalesOrderAdapter({ geo, apply, onCustomerChange }),
    [geo, apply, onCustomerChange],
  );
  const base = useDocumentReviewMode({ adapter, form, apply });
  const { extras, formTax } = base;

  const updateLine = useCallback((id: string, patch: Partial<SOLineItem>) => {
    apply({ lineItems: form.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }, [apply, form.lineItems]);

  /** The money columns of a line after an edit (tax % comes from the form's own line). */
  const calcLine = useCallback((line: ReviewLineLike): { amount: string; total: string } => {
    const full = form.lineItems.find((l) => l.id === line.id);
    return calcLineItem({ ...(full as SOLineItem), ...line } as SOLineItem);
  }, [form.lineItems]);

  /** What the form holds for a header review key (shown beside the document's text). */
  const fieldValue = useCallback((key: string): string => {
    const { data, customer } = form;
    switch (key) {
      case HEADER_KEYS.customer: return customer?.name ?? '';
      case HEADER_KEYS.poNumber: return String(data.purchase_doc_num ?? '');
      case HEADER_KEYS.orderDate: return String(data.date_created ?? '');
      case HEADER_KEYS.expectedDelivery: return extras.expectedDelivery;
      case HEADER_KEYS.shippingCharge: return signedUsd(extras.shippingCharge);
      case HEADER_KEYS.adjustment: return signedUsd(extras.adjustment);
      case HEADER_KEYS.tax: return signedUsd(formTax);
      default: return '';
    }
  }, [form, extras, formTax]);

  return {
    ...base,
    pickCustomer: base.pickParty,
    party: base.handoff?.customer ?? null,
    formPartyId: form.customer?.id,
    lineItems: form.lineItems,
    fieldValue,
    calcLine,
    updateLine,
  };
}

export type { DuplicateConflict };

/** The review-mode controller returned by useSalesOrderReviewMode. */
export type SalesOrderReviewMode = ReturnType<typeof useSalesOrderReviewMode>;
