import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { OverReceiptLine } from '@/lib/itemReceiptErrors';
import { OverReceiptPanel, OVER_RECEIPT_TITLE_ID } from './OverReceiptPanel';

// Modal shown by the New Item Receipt page when save-and-post is refused for
// exceeding the ordered quantity. Nothing was saved (the backend creates and
// posts in one transaction), so confirming re-sends the whole receipt with the
// approver's reason; an approver-less user just gets the explanation.
export function OverReceiptDialog({ lines, canApprove, isPending, onConfirm, onClose }: {
  lines: OverReceiptLine[];
  canApprove: boolean;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const contentRef = useModalDialog(onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={OVER_RECEIPT_TITLE_ID}
        className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none"
      >
        <OverReceiptPanel
          lines={lines}
          canApprove={canApprove}
          isPending={isPending}
          reason={{ value: reason, onChange: setReason }}
          actions={{ onConfirm: () => onConfirm(reason.trim()), onClose }}
        />
      </div>
    </div>,
    document.body,
  );
}
