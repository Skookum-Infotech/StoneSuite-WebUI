import * as React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProvenanceInfo } from '@/lib/salesOrderDocumentHandoff';
import type { FieldConfidence, FieldSource } from '@/types/documentExtraction';

interface FieldProvenanceProps {
  label: string;
  provenance: ProvenanceInfo | undefined;
  needsReview: boolean;
  onShowInDocument: (page?: number, row?: number) => void;
}

const CONFIDENCE_WORD: Record<FieldConfidence, string> = {
  high: 'High',
  check: 'Check',
  not_found: 'Not found',
};

const SOURCE_MARKER: Record<FieldSource, { glyph: string; text: string }> = {
  document: { glyph: '✦', text: 'From document' },
  learned: { glyph: '↺', text: 'Learned' },
  catalog: { glyph: '✦', text: 'From catalog' },
  default: { glyph: '✦', text: 'Default' },
};

const NEEDS_REVIEW = { glyph: '⚑', text: 'Needs review' };

/** Small marker for where a field's value came from (always with its text label)
 *  plus a focusable (i) popover with the source snippet, page and confidence
 *  in words, and a "Show in document" action. */
export function FieldProvenance({ label, provenance, needsReview, onShowInDocument }: FieldProvenanceProps): React.JSX.Element {
  const marker = needsReview ? NEEDS_REVIEW : SOURCE_MARKER[provenance?.source ?? 'document'];
  const canShow = provenance?.page !== undefined || provenance?.snippet !== undefined;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-flex items-center gap-1 text-2xs font-semibold', needsReview ? 'text-warning dark:text-amber-400' : 'text-stone-500 dark:text-stone-400')}>
        <span aria-hidden="true">{marker.glyph}</span>
        {marker.text}
      </span>
      {provenance && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Where ${label} came from`}
              className="inline-flex size-5 items-center justify-center rounded-full text-stone-500 dark:text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-500"
            >
              <Info className="size-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-1.5 text-xs">
            <p className="font-semibold text-stone-900 dark:text-stone-100">{label}</p>
            <p className="text-stone-600 dark:text-stone-300">Source: {SOURCE_MARKER[provenance.source].text}</p>
            <p className="text-stone-600 dark:text-stone-300">Confidence: {CONFIDENCE_WORD[provenance.confidence]}</p>
            {provenance.page !== undefined && <p className="text-stone-600 dark:text-stone-300">Page {provenance.page}</p>}
            {provenance.snippet && (
              <blockquote className="rounded-md bg-stone-50 dark:bg-white/[0.03] px-2 py-1 text-stone-700 dark:text-stone-300">{provenance.snippet}</blockquote>
            )}
            {canShow && (
              <button
                type="button"
                onClick={() => onShowInDocument(provenance.page, provenance.row)}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
              >
                Show in document
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}
