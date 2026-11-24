// Shown when a save/restore gets a 409: the drawing was changed by someone
// else since this editor last loaded it (build spec §5 Task 5). Never
// overwrite silently — the user picks Reload latest (discard local edits,
// pull the current saved version) or Save as copy (force-save local edits
// as the new current version anyway). Same useModalDialog + createPortal
// shape as AreaSidebar.tsx's DeleteAreaDialog — this repo has no Dialog
// primitive, every dialog hand-rolls its own overlay and focus handling.

import { createPortal } from 'react-dom';
import { useModalDialog } from '@/hooks/useModalDialog';

import { buttonVariants } from '@/components/ui/button';
export function ConflictDialog({ onReloadLatest, onSaveAsCopy, onClose }: {
  onReloadLatest: () => void; onSaveAsCopy: () => void; onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawing-conflict-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 id="drawing-conflict-dialog-title" className="type-card-title">
          This Drawing Changed Elsewhere
        </h3>
        <p className="mt-1 type-helper">
          Someone else saved changes to this drawing since it loaded here. Reload to see their
          version, or save your own changes as the new current version anyway.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onReloadLatest}
            className={buttonVariants({ variant: 'outline' })}
          >
            Reload latest
          </button>
          <button
            type="button"
            onClick={onSaveAsCopy}
            className={buttonVariants()}
          >
            Save as copy
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
