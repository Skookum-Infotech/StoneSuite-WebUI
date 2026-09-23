import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText } from 'lucide-react';
import type { Citation } from '@/types/ai';
import { cn } from '@/lib/utils';
import { citationRoute } from './assistantText';

const chipBase = 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors';

function RecordChip({ citation }: { citation: Citation }) {
  const navigate = useNavigate();
  const route = citationRoute(citation);
  const label = `${citation.record_type ?? 'record'}: ${citation.snippet}`;
  if (!route) {
    return (
      <span title={citation.snippet} className={cn(chipBase, 'border-stone-200 bg-stone-100 text-stone-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-400')}>
        <FileText className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{citation.snippet}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => navigate(route)}
      aria-label={`Open ${label}`}
      title={citation.snippet}
      className={cn(chipBase, 'cursor-pointer border-brand/30 bg-brand/10 text-brand-dark hover:bg-brand/20')}
    >
      <FileText className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{citation.snippet}</span>
    </button>
  );
}

/** Help citations have nowhere to navigate, so the chip expands in place to
 *  show the passage — focusable and keyboard-operable, unlike a disabled
 *  button whose only content was a hover tooltip. */
function HelpChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Help reference: ${citation.source_id ?? citation.snippet}`}
        className={cn(chipBase, 'cursor-pointer border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/10')}
      >
        <BookOpen className="size-3 shrink-0" aria-hidden="true" />
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

export function CitationChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {citations.map((citation, idx) =>
        citation.source_type === 'record' ? (
          <RecordChip key={`r-${citation.source_id ?? idx}-${idx}`} citation={citation} />
        ) : (
          <HelpChip key={`h-${citation.source_id ?? idx}-${idx}`} citation={citation} />
        ),
      )}
    </div>
  );
}
