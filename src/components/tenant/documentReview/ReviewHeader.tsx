import * as React from 'react';
import { useEffect, useRef } from 'react';
import { CheckCheck, FileText } from 'lucide-react';
import type { HandoffBadges } from '@/lib/salesOrderDocumentHandoff';

interface ReviewHeaderProps {
  fileName: string;
  badges: HandoffBadges;
  progress: { done: number; total: number };
  onConfirmAll: () => void;
  /** The NeedsReviewNavigator. */
  children: React.ReactNode;
}

function badgeLabels(b: HandoffBadges): string[] {
  const out: string[] = [];
  if (b.signed) out.push('Digitally signed');
  if (b.revision) out.push(`Revision: ${b.revision}`);
  if (b.convertedUnits) out.push('Converted units');
  if (b.wrongType) out.push(`Looks like a ${b.wrongType}`);
  if (b.notRecognized) out.push('Not a purchase order?');
  return out;
}

/** Sticky header of the review screen: file name, badges, "X of Y reviewed"
 *  meter, the navigator and "Confirm all high-confidence". Takes focus on
 *  mount so keyboard and screen-reader users land on the review context. */
export function ReviewHeader({ fileName, badges, progress, onConfirmAll, children }: ReviewHeaderProps): React.JSX.Element {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <header
      aria-label={`Reviewing ${fileName}`}
      className="sticky top-0 z-10 space-y-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-2.5 pl-9 pr-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 text-stone-500 dark:text-stone-400" aria-hidden="true" />
        <h2
          ref={ref}
          tabIndex={-1}
          className="truncate rounded text-sm font-bold text-stone-900 dark:text-stone-100 outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        >
          <span className="sr-only">Reviewing </span>
          {fileName}
        </h2>
        {badgeLabels(badges).map((label) => (
          <span key={label} className="rounded-full border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-2xs font-semibold text-stone-700 dark:text-stone-300">
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-32 flex-1">
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{progress.done} of {progress.total} fields reviewed</p>
          <progress
            aria-label="Fields reviewed"
            value={progress.done}
            max={Math.max(progress.total, 1)}
            className="mt-1 block h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-dark [&::-webkit-progress-bar]:bg-stone-200 dark:[&::-webkit-progress-bar]:bg-stone-700 [&::-webkit-progress-value]:bg-brand-dark"
          />
        </div>
        {children}
        <button
          type="button"
          onClick={onConfirmAll}
          aria-label="Confirm all high-confidence fields as reviewed"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
        >
          <CheckCheck className="size-3.5" aria-hidden="true" />
          Confirm all high-confidence
        </button>
      </div>
    </header>
  );
}
