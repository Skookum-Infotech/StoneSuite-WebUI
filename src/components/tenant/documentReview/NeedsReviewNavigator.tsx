import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { CircleHelp, Flag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReviewItem } from '@/lib/salesOrderDocumentHandoff';

interface NeedsReviewNavigatorProps {
  pending: ReviewItem[];
  onJump: (key: string) => void;
}

/** "Needs review (n)" button that jumps to, and focuses, the next unresolved
 *  field. Alt+ArrowDown / Alt+ArrowUp cycle forward / back from anywhere on the
 *  page; the ? button documents the shortcuts. */
export function NeedsReviewNavigator({ pending, onJump }: NeedsReviewNavigatorProps): React.JSX.Element {
  const lastKey = useRef<string | null>(null);

  const step = useCallback((dir: 1 | -1) => {
    if (pending.length === 0) return;
    const at = pending.findIndex((p) => p.key === lastKey.current);
    // From no position: forward starts at the first, backward at the last.
    const next = at === -1
      ? (dir === 1 ? 0 : pending.length - 1)
      : (at + dir + pending.length) % pending.length;
    lastKey.current = pending[next].key;
    onJump(pending[next].key);
  }, [pending, onJump]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      step(e.key === 'ArrowDown' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => step(1)}
        disabled={pending.length === 0}
        aria-label={`Needs review, ${pending.length} remaining. Jump to next`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-warning dark:border-amber-500/50 bg-warning/10 dark:bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-warning dark:text-amber-400 transition-colors hover:bg-warning/20 dark:hover:bg-amber-500/20 disabled:border-stone-200 dark:disabled:border-stone-700 disabled:bg-stone-50 dark:disabled:bg-white/[0.03] disabled:text-stone-400"
      >
        <Flag className="size-3" aria-hidden="true" />
        Needs review ({pending.length})
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            className="inline-flex size-6 items-center justify-center rounded-full text-stone-500 dark:text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200"
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 text-xs">
          <p className="mb-1.5 font-semibold text-stone-900 dark:text-stone-100">Review shortcuts</p>
          <dl className="space-y-1 text-stone-600 dark:text-stone-300">
            <div className="flex justify-between gap-2"><dt>Next field to review</dt><dd><kbd>Alt</kbd> + <kbd>{'↓'}</kbd></dd></div>
            <div className="flex justify-between gap-2"><dt>Previous field</dt><dd><kbd>Alt</kbd> + <kbd>{'↑'}</kbd></dd></div>
          </dl>
        </PopoverContent>
      </Popover>
    </div>
  );
}
