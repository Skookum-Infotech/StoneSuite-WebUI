import * as React from 'react';
import { Link } from 'react-router-dom';
import { salesOrderPath } from '@/lib/documentExtractionRoutes';
import type { ReviewPhase } from '@/hooks/useDocumentReview';

interface DocumentSourceBannerProps {
  phase: ReviewPhase;
  fileName: string;
  usedRecordUuid: string | undefined;
  aiUnavailable: boolean;
  injection: boolean;
}

/** Source-file banner for review mode. The container is always mounted as a
 *  polite live region so a state change (e.g. the document expiring while the
 *  tab sat open) is announced. */
export function DocumentSourceBanner({
  phase, fileName, usedRecordUuid, aiUnavailable, injection,
}: DocumentSourceBannerProps): React.JSX.Element {
  const messages: React.ReactNode[] = [];
  if (phase === 'expired') {
    messages.push('Source document expired after 24 h — your values are kept; the file won’t be attached.');
  } else if (phase === 'used') {
    messages.push(
      <>
        Already used to create a sales order.{' '}
        {usedRecordUuid && (
          <Link to={salesOrderPath(usedRecordUuid)} className="font-semibold underline">Open it</Link>
        )}
      </>,
    );
  } else if (phase === 'unavailable') {
    messages.push(`${fileName} is no longer available. You can still fill in the order by hand.`);
  } else if (phase === 'ready') {
    messages.push(`Created from ${fileName}. Review every field before saving.`);
  }
  if (aiUnavailable && phase === 'ready') {
    messages.push('AI assist was unavailable, so this was read by rules only — check each value carefully.');
  }
  if (injection && phase === 'ready') {
    messages.push('This document contains text that looks like instructions to an AI assistant. Verify every value against the original.');
  }
  const warn = phase !== 'ready' || aiUnavailable || injection;
  return (
    <div role="status" aria-live="polite" className={warn ? 'border-b border-warning/40 dark:border-amber-500/30 bg-warning/10 dark:bg-amber-500/10 px-4 py-2 text-xs text-stone-800 dark:text-stone-200' : 'border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-white/[0.03] px-4 py-2 text-xs text-stone-700 dark:text-stone-300'}>
      {phase === 'loading' ? 'Loading document…' : messages.map((m, i) => <p key={i}>{m}</p>)}
    </div>
  );
}
