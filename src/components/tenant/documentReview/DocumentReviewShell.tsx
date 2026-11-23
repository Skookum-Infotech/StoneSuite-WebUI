import * as React from 'react';
import { DocumentLinesPanel } from './DocumentLinesPanel';
import { DocumentPane } from './DocumentPane';
import { DocumentSourceBanner } from './DocumentSourceBanner';
import { NeedsReviewNavigator } from './NeedsReviewNavigator';
import { ReviewFieldsPanel } from './ReviewFieldsPanel';
import { ReviewHeader } from './ReviewHeader';
import { ReviewSplitLayout } from './ReviewSplitLayout';
import { TotalsReconcileCard } from './TotalsReconcileCard';
import { UnresolvedChecklist } from './UnresolvedChecklist';
import type { DocumentReviewView, ReviewFieldConfig } from '@/hooks/documentReviewView';

interface DocumentReviewShellProps {
  review: DocumentReviewView;
  /** Which header rows the field panel shows for this document type. */
  fields: ReviewFieldConfig;
  /** The unchanged Add-page form body. */
  children: React.ReactNode;
}

const EMPTY_BADGES = { signed: false, revision: '', convertedUnits: false, wrongType: '', notRecognized: false };

/** Review-mode wrapper for an Add page (Sales Order, Purchase Order, Vendor
 *  Bill): document pane on the left; on the right the review header, banner,
 *  extracted-field and line rows, totals check and checklist above the normal
 *  form. */
export function DocumentReviewShell({ review, fields, children }: DocumentReviewShellProps): React.JSX.Element {
  const handoff = review.handoff;
  return (
    <ReviewSplitLayout
      focusNonce={review.focus?.nonce ?? 0}
      pane={<DocumentPane file={review.file} fileName={review.fileName} pages={review.pages} focus={review.focus} />}
    >
      <p role="status" aria-live="polite" className="sr-only">{review.announcement}</p>
      <ReviewHeader
        fileName={review.fileName}
        badges={handoff?.badges ?? EMPTY_BADGES}
        progress={review.progress}
        onConfirmAll={review.confirmAllHigh}
      >
        <NeedsReviewNavigator pending={review.pending} onJump={review.jumpTo} />
      </ReviewHeader>
      <DocumentSourceBanner
        docType={review.docType}
        phase={review.phase}
        fileName={review.fileName}
        usedRecordUuid={review.banner.usedRecordUuid}
        aiUnavailable={review.banner.aiUnavailable}
        injection={review.banner.injection}
      />
      {handoff && (
        <div className="max-h-[45%] shrink-0 space-y-3 overflow-y-auto border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-white/[0.03] p-3 modal-scrollbar">
          <UnresolvedChecklist pending={review.pending} onJump={review.jumpTo} />
          <ReviewFieldsPanel review={review} fields={fields} />
          <DocumentLinesPanel review={review} />
          <TotalsReconcileCard
            docTotal={handoff.docTotal}
            formTotal={review.preTaxTotal}
            lines={handoff.lines}
            formAmounts={review.formAmounts}
            tax={handoff.docTax > 0 ? { doc: handoff.docTax, form: review.formTax } : undefined}
          />
        </div>
      )}
      {children}
    </ReviewSplitLayout>
  );
}
