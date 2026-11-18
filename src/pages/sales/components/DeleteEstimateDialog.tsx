import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { estimateService } from '@/services/estimateService';
import { apiErrorMessage } from '@/api/tenantClient';
import { DangerZoneAction } from '@/components/tenant/DangerZoneCard';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Mirrors DeleteInvoiceDialog's look, but calls estimateService.deleteEstimate
// directly (no reason field — the estimate DELETE endpoint doesn't accept one).
export function DeleteEstimateDialog({ estimateId, label, onDeleted }: {
  estimateId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => estimateService.deleteEstimate(estimateId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <>
      <DangerZoneAction
        description="Delete this estimate permanently."
        buttonLabel="Delete estimate"
        ariaLabel={`Delete ${label}`}
        onClick={() => setOpen(true)}
      />

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-estimate-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-danger-ink" />
              </div>
              <div>
                <h3 id="delete-estimate-dialog-title" className="type-card-title">
                  Delete Estimate?
                </h3>
                <p className="mt-0.5 type-helper">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-ink mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 type-error">
                {apiErrorMessage(del.error, 'Failed to delete estimate.')}
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
                {del.isPending ? 'Deleting…' : 'Delete estimate'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
