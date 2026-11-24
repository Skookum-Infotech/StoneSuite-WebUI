// The Cutout dialog: opened by "Only Cutout" in the Cutout panel to add an
// opening to the selected piece, or by clicking a cutout in the Cutout tab to
// edit that one. This shell owns the overlay and the loading
// of the cutout types from master data; CutoutForm is the form itself. Same
// hand-rolled useModalDialog + createPortal shape as ConflictDialog.

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Cutout, Piece } from '@/types/drawing';
import { useModalDialog } from '@/hooks/useModalDialog';
import { CutoutForm } from './CutoutForm';
import { useCutoutTypes } from './useCutoutTypes';

import { buttonVariants } from '@/components/ui/button';
export function CutoutDialog({ piece, cutout, onClose }: { piece: Piece; cutout?: Cutout; onClose: () => void }) {
  const contentRef = useModalDialog(onClose);
  const { types, isLoading } = useCutoutTypes();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cutout-dialog-title"
      // z-50, not the z-[9999] other dialogs use: the type and edge dropdowns open
      // in a z-50 popover portal, which would sit behind a higher overlay. Both
      // are on <body>, and the later one (the popover) wins at equal z-index.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 id="cutout-dialog-title" className="type-card-title">Cutout</h2>
          <button type="button" aria-label="Close cutout dialog" onClick={onClose} className="text-ink-muted hover:text-ink-strong">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {types.length > 0 ? (
          <CutoutForm piece={piece} cutout={cutout} types={types} onClose={onClose} />
        ) : (
          <>
            <p role={isLoading ? 'status' : 'alert'} className="px-4 py-8 text-center type-helper">
              {isLoading ? 'Loading cutout types…' : 'The cutout types could not be loaded. Close this and try again.'}
            </p>
            <div className="flex justify-end border-t border-stone-200 px-4 py-3">
              <button type="button" onClick={onClose} className={buttonVariants({ variant: 'outline' })}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
