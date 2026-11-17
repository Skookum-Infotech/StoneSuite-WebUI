import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { vendorService } from '@/services/vendorService';
import { apiErrorMessage } from '@/api/tenantClient';
import { DangerZoneAction } from '@/components/tenant/DangerZoneCard';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Mirrors DeleteSalesOrderDialog's look, but calls vendorService.deleteVendor
// directly (no reason field — the vendor DELETE endpoint doesn't accept one).
export function DeleteVendorDialog({ vendorId, label, onDeleted }: {
  vendorId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => vendorService.deleteVendor(vendorId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <>
      <DangerZoneAction
        description="Delete this vendor permanently."
        buttonLabel="Delete vendor"
        ariaLabel={`Delete ${label}`}
        onClick={() => setOpen(true)}
      />

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-vendor-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-danger-ink" />
              </div>
              <div>
                <h3 id="delete-vendor-dialog-title" className="type-card-title">
                  Delete Vendor?
                </h3>
                <p className="mt-0.5 type-helper">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 type-error">
                {apiErrorMessage(del.error, 'Failed to delete vendor.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                {del.isPending ? 'Deleting…' : 'Delete vendor'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
