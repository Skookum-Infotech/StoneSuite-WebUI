import * as React from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import type { DuplicateConflict } from '@/lib/salesOrderDuplicate';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface DuplicateCreateDialogProps {
  docType: DocumentExtractionDocType;
  conflict: DuplicateConflict;
  onOpenExisting: (uuid: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
  /** Label of the override button; "Create anyway" unless the page edits an existing record. */
  anywayLabel?: string;
}

/** Shown when create answers 409 duplicate_document: a matching document
 *  already exists (same PO number for the customer, same invoice for the vendor). "Open existing" is offered only when
 *  the server revealed it; "Create anyway" resubmits with allowDuplicate. Same
 *  shape as DuplicateRecordDialog. */
export function DuplicateCreateDialog({ docType, conflict, onOpenExisting, onCreateAnyway, onCancel, anywayLabel = 'Create anyway' }: DuplicateCreateDialogProps): React.JSX.Element {
  const { manualNoun } = documentRoutes(docType);
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
          <h3 id="duplicate-so-title" className="dark:text-stone-100 type-card-title">This {manualNoun} may already exist</h3>
        </div>
        <p id="duplicate-so-desc" className="mb-5 text-xs text-stone-600 dark:text-stone-300">{conflict.message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(buttonVariants({ variant: 'outline' }), 'dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-white/10')}
          >
            Cancel
          </button>
          {conflict.existingUuid && (
            <button
              type="button"
              onClick={() => onOpenExisting(conflict.existingUuid as string)}
              aria-label={conflict.existingNumber ? `Open existing ${conflict.existingNumber}` : undefined}
              className={cn(buttonVariants({ variant: 'outline' }), 'dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-white/10')}
            >
              Open existing
            </button>
          )}
          <button
            type="button"
            onClick={onCreateAnyway}
            className={cn(buttonVariants(), 'active:scale-95')}
          >
            {anywayLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
