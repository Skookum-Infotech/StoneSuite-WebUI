import * as React from 'react';
import { DocumentLinesPanel } from '@/components/tenant/documentReview/DocumentLinesPanel';
import { DocumentPane } from '@/components/tenant/documentReview/DocumentPane';
import { DocumentSourceBanner } from '@/components/tenant/documentReview/DocumentSourceBanner';
import { NeedsReviewNavigator } from '@/components/tenant/documentReview/NeedsReviewNavigator';
import { ReviewFieldsPanel } from '@/components/tenant/documentReview/ReviewFieldsPanel';
import { ReviewHeader } from '@/components/tenant/documentReview/ReviewHeader';
import { ReviewSplitLayout } from '@/components/tenant/documentReview/ReviewSplitLayout';
import { TotalsReconcileCard } from '@/components/tenant/documentReview/TotalsReconcileCard';
import { UnresolvedChecklist } from '@/components/tenant/documentReview/UnresolvedChecklist';
import type { SalesOrderReviewMode } from '@/hooks/useSalesOrderReviewMode';

interface SalesOrderReviewShellProps {
  review: SalesOrderReviewMode;
  /** The unchanged Sales Order form body. */
  children: React.ReactNode;
}

const EMPTY_BADGES = { signed: false, revision: '', convertedUnits: false, wrongType: '', notRecognized: false };

/** Review-mode wrapper for the Add Sales Order page: document pane on the left;
 *  on the right the review header, banner, extracted-field and line rows,
 *  totals check and checklist above the normal form. */
export function SalesOrderReviewShell({ review, children }: SalesOrderReviewShellProps): React.JSX.Element {
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
        phase={review.phase}
        fileName={review.fileName}
        usedRecordUuid={review.banner.usedRecordUuid}
        aiUnavailable={review.banner.aiUnavailable}
        injection={review.banner.injection}
      />
      {handoff && (
        <div className="max-h-[45%] shrink-0 space-y-3 overflow-y-auto border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-white/[0.03] p-3 modal-scrollbar">
          <UnresolvedChecklist pending={review.pending} onJump={review.jumpTo} />
          <ReviewFieldsPanel review={review} />
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
