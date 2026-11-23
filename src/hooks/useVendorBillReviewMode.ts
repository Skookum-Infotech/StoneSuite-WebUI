import { useCallback, useMemo } from 'react';
import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { calcLineItem } from '@/lib/vendorBillForm';
import { VB_HEADER_KEYS } from '@/lib/vendorBillHandoffTypes';
import { createVendorBillAdapter } from './vendorBillReviewAdapter';
import { useDocumentReviewMode } from './useDocumentReviewMode';
import type { PoLineChoice, ReviewLineLike, ReviewLinePatch } from './documentReviewView';
import type { VendorBillReviewForm, VendorBillReviewPatch } from './purchaseReviewTypes';

interface Args {
  form: VendorBillReviewForm;
  /** Writes (part of) the page's form state. */
  apply: (next: VendorBillReviewPatch) => void;
  /** The page's vendor-change handler (drops a PO link that belongs to another vendor). */
  onVendorChange: (v: VendorRef | null) => void;
}

const NO_TAX_PERCENT = 0;
const NO_CHOICES: PoLineChoice[] = [];

function signedUsd(raw: unknown): string {
  const n = parseFloat(String(raw ?? '')) || 0;
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

function calcLine(line: ReviewLineLike): { amount: string; total: string } {
  return calcLineItem(line, NO_TAX_PERCENT);
}

/** Everything the Add Vendor Bill page needs for "review a document" mode:
 *  the generic review lifecycle with the Vendor Bill adapter. Inert
 *  (`active === false`) when the page has no ?fromDocument. */
export function useVendorBillReviewMode({ form, apply, onVendorChange }: Args) {
  const adapter = useMemo(() => createVendorBillAdapter({ onVendorChange }), [onVendorChange]);
  const base = useDocumentReviewMode({ adapter, form, apply });
  const { formTax, handoff } = base;

  const updateLine = useCallback((id: string, patch: ReviewLinePatch) => {
    apply({ lineItems: form.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }, [apply, form.lineItems]);

  const poLineChoices = useCallback((lineId: string): PoLineChoice[] => {
    const ids = handoff?.purchaseOrder.candidates[lineId];
    if (!ids || !handoff) return NO_CHOICES;
    return handoff.purchaseOrder.lines
      .filter((p) => ids.includes(p.id))
      .map((p) => ({ id: p.id, label: `PO line ${p.lineNumber}: ${p.description}` }));
  }, [handoff]);
  const poLineOf = useCallback(
    (lineId: string): string => form.lineItems.find((l) => l.id === lineId)?.purchaseOrderItemId ?? '',
    [form.lineItems],
  );
  const setPoLine = useCallback((lineId: string, poItemId: string) => {
    apply({ lineItems: form.lineItems.map((l) => (l.id === lineId ? { ...l, purchaseOrderItemId: poItemId || null } : l)) });
  }, [apply, form.lineItems]);

  const fieldValue = useCallback((key: string): string => {
    const { data, vendor, purchaseOrder } = form;
    switch (key) {
      case VB_HEADER_KEYS.vendor: return vendor?.name ?? '';
      case VB_HEADER_KEYS.invoiceNumber: return String(data.vendor_invoice_number ?? '');
      case VB_HEADER_KEYS.billDate: return String(data.bill_date ?? '');
      case VB_HEADER_KEYS.dueDate: return String(data.due_date ?? '');
      case VB_HEADER_KEYS.purchaseOrder: return purchaseOrder?.number ?? '';
      case VB_HEADER_KEYS.adjustment: return signedUsd(data.adjustment);
      case VB_HEADER_KEYS.tax: return signedUsd(formTax);
      default: return '';
    }
  }, [form, formTax]);

  return {
    ...base,
    party: handoff?.vendor ?? null,
    formPartyId: form.vendor?.id,
    lineItems: form.lineItems,
    fieldValue,
    calcLine,
    updateLine,
    poLineChoices,
    poLineOf,
    setPoLine,
  };
}

/** The review-mode controller returned by useVendorBillReviewMode. */
export type VendorBillReviewMode = ReturnType<typeof useVendorBillReviewMode>;
