import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { vendorBillService } from '@/services/vendorBillService';
import { apiErrorMessage } from '@/api/tenantClient';
import { DangerZoneAction } from '@/components/tenant/DangerZoneCard';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Mirrors DeletePurchaseOrderDialog's focus management (moves focus into the
// panel on open, restores it to the trigger on close, closes on Escape) — a
// createPortal overlay isn't natively part of the DOM's focus order, so none
// of that happens for free. The backend only accepts delete at DRFT/VOID;
// callers gate the trigger on VB_DELETABLE_STATUSES so a 400 here should
// never actually happen, but the error still surfaces if it does.
export function DeleteVendorBillDialog({ vendorBillId, label, onDeleted }: {
  vendorBillId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const del = useMutation({
    mutationFn: () => vendorBillService.deleteVendorBill(vendorBillId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !del.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, del.isPending]);

  return (
    <>
      <DangerZoneAction
        ref={triggerRef}
        description="Delete this vendor bill permanently."
        buttonLabel="Delete vendor bill"
        ariaLabel={`Delete ${label}`}
        onClick={() => setOpen(true)}
      />

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-vb-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !del.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-danger-ink" />
              </div>
              <div>
                <h3 id="delete-vb-dialog-title" className="type-card-title">
                  Delete Vendor Bill?
                </h3>
                <p className="mt-0.5 type-helper">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-ink mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 type-error">
                {apiErrorMessage(del.error, 'Failed to delete vendor bill.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={del.isPending}
                className={buttonVariants({ variant: 'outline' })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className={cn(buttonVariants({ variant: 'destructive' }), 'active:scale-95')}
              >
                {del.isPending ? 'Deleting…' : 'Delete vendor bill'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
