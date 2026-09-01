import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModalDialog } from '@/hooks/useModalDialog';
import { apiErrorMessage } from '@/api/tenantClient';
import { requisitionService } from '@/services/requisitionService';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { VendorPicker, type VendorRef } from '../../purchase-order/components/VendorPicker';
import type { RequisitionConvertResult, RequisitionVendorRef } from '@/types/requisition';

// Vendor-selection modal for converting an approved requisition into a
// purchase order (POST /requisitions/{id}/convert).
//
// The vendor picker is pre-filled from the requisition's suggested vendor but
// the choice must be confirmed: `vendorUuid` is required by the API precisely
// because a requisition's vendor is only ever a suggestion and is never
// silently promoted to the purchase order's mandatory vendor. Submitting with
// no vendor selected is blocked client-side rather than sent, since the server
// would reject it with a 400 anyway.
//
// The endpoint is idempotent — replaying it against an already-converted
// requisition returns the existing purchase order with `created: false`
// instead of making a duplicate. That is a success, not an error, so it
// navigates to the purchase order exactly like a fresh conversion.
export function ConvertToPurchaseOrderDialog({
  requisitionId, requisitionNumber, suggestedVendor, onClose, onConverted,
}: {
  requisitionId: string;
  requisitionNumber: string;
  suggestedVendor?: RequisitionVendorRef;
  onClose: () => void;
  onConverted: (result: RequisitionConvertResult) => void;
}) {
  const contentRef = useModalDialog(onClose);
  const [vendor, setVendor] = useState<VendorRef | null>(
    suggestedVendor ? { id: suggestedVendor.id, name: suggestedVendor.name } : null,
  );

  const convert = useMutation({
    mutationFn: () => {
      // The submit button is disabled without a vendor; this guard keeps that
      // invariant explicit rather than asserting it away.
      if (!vendor) throw new Error('A vendor is required to create a purchase order.');
      return requisitionService.convert(requisitionId, vendor.id);
    },
    onSuccess: onConverted,
  });

  const changedFromSuggestion = Boolean(
    suggestedVendor && vendor && vendor.id !== suggestedVendor.id,
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqn-convert-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <ArrowRightLeft className="size-4 text-accent-foreground" />
          </div>
          <div>
            <h3 id="reqn-convert-title" className="text-sm font-bold text-stone-900">
              Convert to Purchase Order
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">{requisitionNumber}</p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          This creates a draft purchase order from the requisition&rsquo;s lines. Confirm the
          vendor to order from — a purchase order always needs one.
        </p>

        <ModernFieldShell label="Vendor" required>
          <VendorPicker value={vendor} onChange={setVendor} required />
        </ModernFieldShell>

        {suggestedVendor ? (
          <p className="mt-1.5 text-2xs text-stone-400">
            {changedFromSuggestion
              ? `Requisition suggested ${suggestedVendor.name}.`
              : `Pre-filled from the requisition’s suggested vendor.`}
          </p>
        ) : (
          <p className="mt-1.5 text-2xs text-stone-400">
            This requisition didn&rsquo;t suggest a vendor — pick the one to order from.
          </p>
        )}

        {convert.error && (
          <p className="mt-3 text-2xs text-destructive">
            {apiErrorMessage(convert.error, 'Failed to convert requisition.')}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
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
            disabled={!vendor || convert.isPending}
            aria-label="Create purchase order from this requisition"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition-all',
              'hover:bg-brand-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
            )}
          >
            {convert.isPending && <Loader2 className="size-3 animate-spin" />}
            {convert.isPending ? 'Converting…' : 'Create Purchase Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
