import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { apiErrorMessage } from '@/api/tenantClient';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { VendorBill } from '@/types/vendorBill';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Confirmation modal for POST /purchase-orders/{id}/convert-to-bill. Unlike
// ConvertToPurchaseOrderDialog (requisition -> PO), there is no vendor
// picker here — a vendor bill's vendor comes directly from the source
// purchase order and is never chosen separately. A confirm step matters
// specifically because this endpoint is NOT idempotent: a PO may be
// converted to more than one bill (installment billing), so every confirm
// creates a brand-new AP document — an accidental double-click on an
// unconfirmed action would silently duplicate it.
export function ConvertToBillDialog({
  purchaseOrderId, purchaseOrderNumber, vendorName, grandTotal, onClose, onConverted,
}: {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  vendorName: string;
  grandTotal: number;
  onClose: () => void;
  onConverted: (bill: VendorBill) => void;
}) {
  const contentRef = useModalDialog(onClose);

  const convert = useMutation({
    mutationFn: () => purchaseOrderService.convertToBill(purchaseOrderId),
    onSuccess: onConverted,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-to-bill-title"
      onClick={(e) => e.target === e.currentTarget && !convert.isPending && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-accent">
            <ArrowRightLeft className="size-4 text-accent-foreground" />
          </div>
          <div>
            <h3 id="convert-to-bill-title" className="text-sm font-bold text-stone-900">
              Create a vendor bill?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">From {purchaseOrderNumber}</p>
          </div>
        </div>

        <div className="mb-5 space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-500">Vendor</span>
            <span className="font-medium text-stone-800">{vendorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Grand Total</span>
            <span className="font-semibold text-stone-900 tabular-nums">{currency(grandTotal)}</span>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          This creates a new Draft vendor bill snapshotting this order's line items. A purchase order can be
          converted more than once — each confirm creates another bill (useful for installment billing).
        </p>

        {convert.error && (
          <p className="mb-3 text-xs text-destructive">
            {apiErrorMessage(convert.error, 'Failed to convert this purchase order to a vendor bill.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={convert.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => convert.mutate()}
            disabled={convert.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {convert.isPending ? <Loader2 className="size-3 animate-spin" /> : <ArrowRightLeft className="size-3" />}
            {convert.isPending ? 'Creating…' : 'Create vendor bill'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
