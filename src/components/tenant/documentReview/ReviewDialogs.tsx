import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmLeaveDialog } from '@/components/ConfirmLeaveDialog';
import { salesOrderPath } from '@/lib/documentExtractionRoutes';
import { DuplicateCreateDialog } from './DuplicateCreateDialog';
import type { SalesOrderReviewMode } from '@/hooks/useSalesOrderReviewMode';

interface ReviewDialogsProps {
  review: SalesOrderReviewMode;
  /** Resubmits the create with allowDuplicate. */
  onCreateAnyway: () => void;
  /** Lets the unsaved-changes guard step aside before leaving. */
  markClean: () => void;
}

/** The two review-mode confirmations: the duplicate-PO 409 and Discard. */
export function ReviewDialogs({ review, onCreateAnyway, markClean }: ReviewDialogsProps): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      {review.duplicate && (
        <DuplicateCreateDialog
          conflict={review.duplicate}
          onOpenExisting={(uuid) => { review.dismissDuplicate(); markClean(); navigate(salesOrderPath(uuid)); }}
          onCreateAnyway={() => { review.dismissDuplicate(); onCreateAnyway(); }}
          onCancel={review.dismissDuplicate}
        />
      )}
      {review.confirmingDiscard && (
        <ConfirmLeaveDialog
          variant="discard-document"
          onConfirm={() => review.confirmDiscard(markClean)}
          onCancel={review.cancelDiscard}
        />
      )}
    </>
  );
}
