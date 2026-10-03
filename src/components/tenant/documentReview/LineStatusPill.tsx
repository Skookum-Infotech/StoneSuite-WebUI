import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LinePillKind } from '@/lib/salesOrderDocumentHandoff';

interface LineStatusPillProps {
  kind: LinePillKind;
  label: string;
}

const TONE: Record<LinePillKind, string> = {
  matched: 'border-accent-foreground/20 bg-accent text-accent-foreground',
  learned: 'border-accent-foreground/20 bg-accent text-accent-foreground',
  pick_item: 'border-warning dark:border-amber-500/50 bg-warning/10 dark:bg-amber-500/10 text-warning dark:text-amber-400',
  addon: 'border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
  converted: 'border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
  price_differs: 'border-warning dark:border-amber-500/50 bg-warning/10 dark:bg-amber-500/10 text-warning dark:text-amber-400',
};

/** One status chip on a document line (Matched, Learned, Pick item, Add-on to
 *  line N, Unit converted, Price differs from catalog). The text carries the
 *  meaning; colour only reinforces it. */
export function LineStatusPill({ kind, label }: LineStatusPillProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold', TONE[kind])}>
      {label}
    </span>
  );
}
