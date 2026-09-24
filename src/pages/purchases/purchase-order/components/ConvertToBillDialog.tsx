import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { FilePlus, Loader2 } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { apiErrorMessage } from '@/api/tenantClient';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { BillableLine } from '@/lib/purchaseOrderForm';
import type { VendorBill } from '@/types/vendorBill';

// Confirmation modal for POST /purchase-orders/{id}/convert-to-bill (the Create
// Bill button). Unlike ConvertToPurchaseOrderDialog (requisition -> PO), there
// is no vendor picker here — a vendor bill's vendor comes directly from the
// source purchase order and is never chosen separately. It lists what the bill
// will cover: the goods received and not yet billed, not the whole order, so a
// partly received order can be billed for its first delivery and again for the
// next. A confirm step matters because the endpoint is NOT idempotent — every
// confirm creates a brand-new AP document, so an accidental double-click on an
// unconfirmed action would silently duplicate it.
export function ConvertToBillDialog({ purchaseOrder, lines, onClose, onConverted }: {
  purchaseOrder: { id: string; number: string; vendorName: string };
  lines: BillableLine[];
  onClose: () => void;
  onConverted: (bill: VendorBill) => void;
}) {
  const contentRef = useModalDialog(onClose);

  const convert = useMutation({
    mutationFn: () => purchaseOrderService.convertToBill(purchaseOrder.id),
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
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-accent">
            <FilePlus className="size-4 text-accent-foreground" />
          </div>
          <div>
            <h3 id="convert-to-bill-title" className="text-sm font-bold text-stone-900">
              Create a vendor bill?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">From {purchaseOrder.number}</p>
          </div>
        </div>

        <div className="mb-3 flex justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs">
          <span className="text-stone-500">Vendor</span>
          <span className="font-medium text-stone-800">{purchaseOrder.vendorName}</span>
        </div>

        <p className="mb-2 text-xs font-semibold text-stone-700">This bill will cover</p>
        <ul aria-label="Lines on the new bill" className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 px-3 py-2 text-xs modal-scrollbar">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-stone-700">{line.lineNumber}. {line.itemName || 'Item'}</span>
              <span className="shrink-0 tabular-nums text-stone-500">
                <span className="font-semibold text-stone-900">{line.toBill}</span> of {line.ordered} ordered
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-stone-600 mb-4">
          A Draft bill is created for the goods received so far that haven&apos;t been billed yet, at this order&apos;s
          prices. When more arrives, create another bill for the rest.
        </p>

        {convert.error && (
          <p role="alert" className="mb-3 text-xs text-destructive">
            {apiErrorMessage(convert.error, 'Failed to create a vendor bill from this purchase order.')}
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
            {convert.isPending ? <Loader2 className="size-3 animate-spin" /> : <FilePlus className="size-3" />}
            {convert.isPending ? 'Creating…' : 'Create vendor bill'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
