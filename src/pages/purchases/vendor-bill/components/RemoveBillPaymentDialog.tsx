import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorBillService } from '@/services/vendorBillService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';

// Soft-deletes one settlement ledger row (the "unapply") and recomputes the
// bill's AP rollup — DELETE /vendor-bills/{id}/payments/{paymentId}. Mirrors
// DeletePaymentDialog; RBAC is vendor_bill:update (a payment mutates the
// bill's own rollup, not a separate resource).
export function RemoveBillPaymentDialog({ vendorBillId, paymentId, label, onRemoved }: {
  vendorBillId: string;
  paymentId: string;
  label: string;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const contentRef = useModalDialog(() => setOpen(false));

  const remove = useMutation({
    mutationFn: () => vendorBillService.removePayment(vendorBillId, paymentId),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', vendorBillId] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bill-payments', vendorBillId] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      onRemoved();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${label}`}
        className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-1.5 text-stone-400 transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive cursor-pointer"
      >
        <Trash2 className="size-3.5" />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-vb-payment-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !remove.isPending && setOpen(false)}
        >
          <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="remove-vb-payment-dialog-title" className="text-sm font-bold text-stone-900">
                  Remove payment?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This recalculates the bill's balance due.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be removed from the settlement ledger.
            </p>

            {remove.error && (
              <p className="mb-3 text-xs text-destructive">
                {apiErrorMessage(remove.error, 'Failed to remove payment.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={remove.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {remove.isPending ? 'Removing…' : 'Remove payment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
