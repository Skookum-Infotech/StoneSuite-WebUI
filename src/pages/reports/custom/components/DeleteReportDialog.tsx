import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useModalDialog } from "@/hooks/useModalDialog";

import { buttonVariants } from '@/components/ui/button';
interface DeleteReportDialogProps {
  name: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before deleting a saved report; a shared report disappears for everyone. */
export function DeleteReportDialog({ name, pending, onConfirm, onCancel }: DeleteReportDialogProps) {
  const contentRef = useModalDialog(onCancel);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-report-title"
      aria-describedby="delete-report-desc"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <Trash2 className="size-4 text-warning" aria-hidden="true" />
          </div>
          <h3 id="delete-report-title" className="type-card-title">
            Delete This Report?
          </h3>
        </div>
        <p id="delete-report-desc" className="mb-5 text-xs text-ink">
          &ldquo;{name}&rdquo; will be removed. If it is shared with the workspace, nobody will be able to open it any more.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label="Delete"
            disabled={pending}
            onClick={onConfirm}
            className={buttonVariants({ variant: 'destructive' })}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
