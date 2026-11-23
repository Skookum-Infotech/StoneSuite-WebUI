import * as React from 'react';
import { cn } from '@/lib/utils';

interface ReviewFieldFrameProps {
  reviewKey: string;
  needsReview: boolean;
  onFieldFocus: () => void;
  children: React.ReactNode;
}

/** Wrapper that gives a review row its amber needs-review border and registers
 *  it as a jump target for the navigator (data-review-row). The border is added
 *  here rather than by editing each input. */
export function ReviewFieldFrame({ reviewKey, needsReview, onFieldFocus, children }: ReviewFieldFrameProps): React.JSX.Element {
  return (
    <div
      data-review-row={reviewKey}
      onFocusCapture={onFieldFocus}
      className={cn(
        'space-y-1.5 rounded-lg border p-2.5 text-xs',
        needsReview ? 'border-warning dark:border-amber-500/50 bg-warning/5 dark:bg-amber-500/5' : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900',
      )}
    >
      {children}
    </div>
  );
}
