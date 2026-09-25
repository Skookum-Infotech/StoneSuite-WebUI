import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText } from 'lucide-react';
import type { Citation } from '@/types/ai';
import { cn } from '@/lib/utils';
import { citationRoute } from './assistantText';

const chipBase = 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors';
/** How long a chip stays visually highlighted after a [n] marker jumps to it. */
const HIGHLIGHT_MS = 1500;

/** One citation paired with the [n] marker number it answers to — the
 *  position of its source in the turn's raw retrieved set, not just its
 *  index in this (possibly reordered/filtered) chip list. */
export interface NumberedCitation {
  citation: Citation;
  n: number;
}

export interface CitationChipsHandle {
  /** Scrolls chip n into view and flashes it briefly — called when an [n]
   *  marker with nowhere to navigate (a help source) is clicked in the answer. */
  scrollToAndHighlight: (n: number) => void;
}

function RecordChip({ citation, n, highlighted, chipRef }: { citation: Citation; n: number; highlighted: boolean; chipRef: (el: HTMLElement | null) => void }) {
  const navigate = useNavigate();
  const route = citationRoute(citation);
  const label = `${citation.record_type ?? 'record'}: ${citation.snippet}`;
  if (!route) {
    return (
      <span
        ref={chipRef}
        // Not otherwise interactive (no route to open), but scrollToAndHighlight
        // moves focus here when its [n] marker is activated — needs to be a
        // focus target for that, without joining the page's own Tab order.
        tabIndex={-1}
        title={citation.snippet}
        className={cn(chipBase, 'border-stone-200 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-400', highlighted && 'ring-2 ring-brand')}
      >
        <FileText className="size-3 shrink-0" aria-hidden="true" />
        <span className="shrink-0 tabular-nums">[{n}]</span>
        <span className="truncate">{citation.snippet}</span>
      </span>
    );
  }
  return (
    <button
      ref={chipRef as unknown as (el: HTMLButtonElement | null) => void}
      type="button"
      onClick={() => navigate(route)}
      aria-label={`Open ${label}`}
      title={citation.snippet}
      className={cn(chipBase, 'cursor-pointer border-brand/30 bg-brand/10 text-brand-dark hover:bg-brand/20', highlighted && 'ring-2 ring-brand')}
    >
      <FileText className="size-3 shrink-0" aria-hidden="true" />
      <span className="shrink-0 tabular-nums">[{n}]</span>
      <span className="truncate">{citation.snippet}</span>
    </button>
  );
}

/** Help citations have nowhere to navigate, so the chip expands in place to
 *  show the passage — focusable and keyboard-operable, unlike a disabled
 *  button whose only content was a hover tooltip. */
function HelpChip({ citation, n, highlighted, chipRef }: { citation: Citation; n: number; highlighted: boolean; chipRef: (el: HTMLElement | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="flex max-w-full flex-col items-start gap-1">
      <button
        // The chip's focus target is the button itself, not the wrapping
        // span — scrollToAndHighlight needs a real focusable element.
        ref={chipRef as unknown as (el: HTMLButtonElement | null) => void}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Help reference: ${citation.source_id ?? citation.snippet}`}
        className={cn(chipBase, 'cursor-pointer border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/10', highlighted && 'ring-2 ring-brand')}
      >
        <BookOpen className="size-3 shrink-0" aria-hidden="true" />
        <span className="shrink-0 tabular-nums">[{n}]</span>
        <span className="truncate">{citation.source_id ?? citation.snippet}</span>
      </button>
      {open && (
        <span className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-2xs text-stone-600 dark:bg-white/[0.04] dark:text-stone-300">
          {citation.snippet}
        </span>
      )}
    </span>
  );
}

export const CitationChips = forwardRef<CitationChipsHandle, { items: NumberedCitation[] }>(function CitationChips({ items }, ref) {
  const chipEls = useRef<Record<number, HTMLElement | null>>({});
  const [highlightedN, setHighlightedN] = useState<number | null>(null);
  // A [n] marker with nowhere to navigate has no other feedback that
  // anything happened — this announces which source it jumped to, for
  // whoever can't see the scroll/highlight.
  const [announcement, setAnnouncement] = useState('');

  useImperativeHandle(ref, () => ({
    scrollToAndHighlight(n: number) {
      const el = chipEls.current[n];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el?.focus();
      if (el) setAnnouncement(`Source ${n}`);
      setHighlightedN(n);
      window.setTimeout(() => setHighlightedN((cur) => (cur === n ? null : cur)), HIGHLIGHT_MS);
    },
  }), []);

  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {items.map(({ citation, n }) =>
        citation.source_type === 'record' ? (
          <RecordChip
            key={`r-${citation.source_id ?? n}-${n}`}
            citation={citation}
            n={n}
            highlighted={highlightedN === n}
            chipRef={(el) => { chipEls.current[n] = el; }}
          />
        ) : (
          <HelpChip
            key={`h-${citation.source_id ?? n}-${n}`}
            citation={citation}
            n={n}
            highlighted={highlightedN === n}
            chipRef={(el) => { chipEls.current[n] = el; }}
          />
        ),
      )}
    </div>
  );
});
