import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmLeaveDialog } from '@/components/ConfirmLeaveDialog';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import { DuplicateCreateDialog } from './DuplicateCreateDialog';
import type { DocumentReviewDialogState } from '@/hooks/documentReviewModeTypes';

interface ReviewDialogsProps {
  review: DocumentReviewDialogState;
  /** Resubmits the create with allowDuplicate. */
  onCreateAnyway: () => void;
  /** Lets the unsaved-changes guard step aside before leaving. */
  markClean: () => void;
}

/** The two review-mode confirmations: the duplicate-document 409 and Discard. */
export function ReviewDialogs({ review, onCreateAnyway, markClean }: ReviewDialogsProps): React.JSX.Element {
  const navigate = useNavigate();
  const routes = documentRoutes(review.docType);
  return (
    <>
      {review.duplicate && (
        <DuplicateCreateDialog
          conflict={review.duplicate}
          docType={review.docType}
          onOpenExisting={(uuid) => { review.dismissDuplicate(); markClean(); navigate(routes.recordPath(uuid)); }}
          onCreateAnyway={() => { review.dismissDuplicate(); onCreateAnyway(); }}
          onCancel={review.dismissDuplicate}
        />
      )}
      {review.confirmingDiscard && (
        <ConfirmLeaveDialog
          variant="discard-document"
          recordNoun={routes.noun}
          onConfirm={() => review.confirmDiscard(markClean)}
          onCancel={review.cancelDiscard}
        />
      )}
    </>
  );
}
