import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { DangerZoneAction } from '@/components/tenant/DangerZoneCard';

// Mirrors DeleteItemDialog's focus management and confirm UX.
export function DeleteKitDialog({ kitId, label, onDeleted }: {
  kitId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const del = useMutation({
    mutationFn: () => inventoryService.deleteKit(kitId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  useEffect(() => {
    if (open) panelRef.current?.focus();
    else triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !del.isPending) setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, del.isPending]);

  return (
    <>
      <DangerZoneAction
        ref={triggerRef}
        description="Delete this kit. Documents already built from it keep their lines."
        buttonLabel="Delete kit"
        ariaLabel={`Delete ${label}`}
        onClick={() => setOpen(true)}
      />

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-kit-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !del.isPending && setOpen(false)}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="delete-kit-dialog-title" className="text-sm font-bold text-stone-900">Delete kit?</h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be deleted. Its items are not affected, and documents
              already built from it keep their lines and its heading.
            </p>

            {del.error && (
              <p className="mb-3 text-xs text-destructive">{apiErrorMessage(del.error, 'Failed to delete kit.')}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {del.isPending ? 'Deleting…' : 'Delete kit'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
