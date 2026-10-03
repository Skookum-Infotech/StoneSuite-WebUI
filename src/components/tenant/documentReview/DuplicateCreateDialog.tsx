import * as React from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { DuplicateConflict } from '@/hooks/useSalesOrderReviewMode';

interface DuplicateCreateDialogProps {
  conflict: DuplicateConflict;
  onOpenExisting: (uuid: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}

/** Shown when create answers 409 duplicate_document: a sales order with this PO
 *  number already exists for the customer. "Open existing" is offered only when
 *  the server revealed it; "Create anyway" resubmits with allowDuplicate. Same
 *  shape as DuplicateRecordDialog. */
export function DuplicateCreateDialog({ conflict, onOpenExisting, onCreateAnyway, onCancel }: DuplicateCreateDialogProps): React.JSX.Element {
  const contentRef = useModalDialog(onCancel);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-so-title"
      aria-describedby="duplicate-so-desc"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white dark:bg-stone-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 dark:bg-amber-500/10">
            <TriangleAlert className="size-4 text-warning dark:text-amber-400" aria-hidden="true" />
          </div>
          <h3 id="duplicate-so-title" className="text-sm font-bold text-stone-900 dark:text-stone-100">This order may already exist</h3>
        </div>
        <p id="duplicate-so-desc" className="mb-5 text-xs text-stone-600 dark:text-stone-300">{conflict.message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          {conflict.existingUuid && (
            <button
              type="button"
              onClick={() => onOpenExisting(conflict.existingUuid as string)}
              aria-label={conflict.existingNumber ? `Open existing ${conflict.existingNumber}` : undefined}
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
            >
              Open existing
            </button>
          )}
          <button
            type="button"
            onClick={onCreateAnyway}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 transition-all hover:bg-brand-hover active:scale-95"
          >
            Create anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
