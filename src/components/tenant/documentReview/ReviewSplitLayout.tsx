import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useModalDialog } from '@/hooks/useModalDialog';

interface ReviewSplitLayoutProps {
  /** The DocumentPane. */
  pane: React.ReactNode;
  /** Bumps when "Show in document" is used, so a closed pane opens. */
  focusNonce: number;
  children: React.ReactNode;
}

// Tailwind needs literal class names (and inline styles are not allowed), so the
// resizable width is a set of steps rather than a free pixel value.
const PANE_WIDTHS = ['w-[30%]', 'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-[50%]', 'w-[55%]', 'w-[60%]'] as const;
const DEFAULT_STEP = 3;
const MIN_PCT = 30;
const STEP_PCT = 5;
/** Below this width a 45% pane leaves the form too narrow, so it starts collapsed. */
const WIDE_QUERY = '(min-width: 1280px)';

interface DocumentSheetProps {
  pane: React.ReactNode;
  onClose: () => void;
}

/** Mobile bottom sheet: a modal dialog (focus in on open, Tab trapped, Escape
 *  closes, focus returns to whatever opened it). */
function DocumentSheet({ pane, onClose }: DocumentSheetProps): React.JSX.Element {
  const ref = useModalDialog(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Source document"
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[70vh] flex-col rounded-t-xl border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close document"
        className="absolute right-2 top-1.5 z-10 rounded-full p-1 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="min-h-0 flex-1">{pane}</div>
    </div>
  );
}

/** Review-mode shell: the document pane on the left (pinned while the form
 *  scrolls, resizable in steps by drag or arrow keys, collapsible) and the form
 *  on the right. It starts collapsed below 1280px. Below 768px the pane becomes
 *  a bottom sheet opened by a "View document" button. */
export function ReviewSplitLayout({ pane, focusNonce, children }: ReviewSplitLayoutProps): React.JSX.Element {
  const mobile = useMediaQuery('(max-width: 767px)');
  const wide = useMediaQuery(WIDE_QUERY);
  const [collapsed, setCollapsed] = useState(() => !wide);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(DEFAULT_STEP);
  const rootRef = useRef<HTMLDivElement>(null);
  const seenNonce = useRef(focusNonce);

  useEffect(() => {
    if (focusNonce === seenNonce.current) return;
    seenNonce.current = focusNonce;
    setCollapsed(false);
    setSheetOpen(true);
  }, [focusNonce]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const clamp = (n: number): number => Math.min(PANE_WIDTHS.length - 1, Math.max(0, n));
  const onDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.buttons !== 1 || !rootRef.current) return;
    const box = rootRef.current.getBoundingClientRect();
    const pct = ((e.clientX - box.left) / box.width) * 100;
    setStep(clamp(Math.round((pct - MIN_PCT) / STEP_PCT)));
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setStep((s) => clamp(s - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setStep((s) => clamp(s + 1)); }
    if (e.key === 'Home') { e.preventDefault(); setStep(0); }
    if (e.key === 'End') { e.preventDefault(); setStep(PANE_WIDTHS.length - 1); }
  };

  if (mobile) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-16 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 shadow-lg"
        >
          <FileText className="size-3.5" aria-hidden="true" />
          View document
        </button>
        {sheetOpen && <DocumentSheet pane={pane} onClose={closeSheet} />}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1">
      {!collapsed && (
        <div className={cn('sticky top-16 flex h-[calc(100dvh-8rem)] shrink-0 self-start', PANE_WIDTHS[step])}>
          <div className="min-h-0 min-w-0 flex-1 border-r border-stone-200 dark:border-stone-800">{pane}</div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize document pane"
            aria-valuemin={MIN_PCT}
            aria-valuemax={MIN_PCT + STEP_PCT * (PANE_WIDTHS.length - 1)}
            aria-valuenow={MIN_PCT + STEP_PCT * step}
            tabIndex={0}
            onPointerMove={onDrag}
            onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
            onKeyDown={onKey}
            className="relative w-1.5 shrink-0 cursor-col-resize bg-stone-200 before:absolute before:left-1/2 before:top-1/2 before:h-8 before:w-0.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-stone-500 dark:before:bg-stone-400 dark:bg-stone-700 transition-colors hover:bg-stone-300 dark:hover:bg-stone-600 focus-visible:bg-stone-400 dark:focus-visible:bg-stone-500 focus-visible:outline-none"
          />
        </div>
      )}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Show document pane' : 'Hide document pane'}
          aria-expanded={!collapsed}
          className="absolute left-1 top-1 z-20 rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-1 text-stone-500 dark:text-stone-400 shadow-sm hover:text-stone-800 dark:hover:text-stone-100"
        >
          {collapsed ? <PanelLeftOpen className="size-3.5" aria-hidden="true" /> : <PanelLeftClose className="size-3.5" aria-hidden="true" />}
        </button>
        {children}
      </div>
    </div>
  );
}
