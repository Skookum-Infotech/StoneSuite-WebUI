import * as React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModalDialog } from '@/hooks/useModalDialog';
import { duplicateDialogCopy, type DuplicateDialogEntity, type DuplicateMatchStatus } from '@/lib/duplicateRecordCheck';

interface DuplicateRecordDialogProps {
  entity: DuplicateDialogEntity;
  match: { name: string; statusLabel: string; status: DuplicateMatchStatus };
  /** Called when the user confirms "Activate & Use". Omitted for an entity/
   *  status combination that can't be activated from here (e.g. Item) — the
   *  button is then not rendered at all. */
  onActivate?: () => void;
  onCancel: () => void;
  isActivating: boolean;
}

/** Shown from the Add Customer/Vendor/Item pages when the typed name exactly
 *  matches an existing record, so the user reuses (and, where possible,
 *  reactivates) it instead of creating a duplicate. Mirrors ConfirmLeaveDialog's
 *  hand-rolled portal + focus-trap shape — this repo has no Dialog primitive. */
export function DuplicateRecordDialog({
  entity, match, onActivate, onCancel, isActivating,
}: DuplicateRecordDialogProps): React.JSX.Element {
  const contentRef = useModalDialog(onCancel);
  const copy = duplicateDialogCopy(entity, match.status, match.name, match.statusLabel);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-record-title"
      aria-describedby="duplicate-record-desc"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10">
            <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
          </div>
          <h3 id="duplicate-record-title" className="text-sm font-bold text-stone-900">
            {copy.title}
          </h3>
        </div>

        <p id="duplicate-record-desc" className="mb-5 text-xs text-stone-600">
          {copy.body}
        </p>

        <div className="flex justify-end gap-2">
          {copy.showActivate ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancel"
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onActivate?.()}
                disabled={isActivating}
                aria-label="Activate and use the existing record"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900',
                  'transition-all active:scale-95 hover:bg-brand-hover disabled:opacity-50',
                )}
              >
                {isActivating && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                {isActivating ? 'Activating…' : 'Activate & Use'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              aria-label="OK"
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 transition-all hover:bg-brand-hover active:scale-95"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
