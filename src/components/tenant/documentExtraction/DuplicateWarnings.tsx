import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import { duplicateStatusText } from '@/lib/documentDuplicateStatus';
import type { ExtractionDuplicate } from '@/types/documentExtraction';

interface DuplicateWarningsProps {
  duplicates: ExtractionDuplicate[];
  onOpenExisting: (recordUuid: string) => void;
  onCreateAnyway: () => void;
}

/** The server's duplicate / revision findings for a ready extraction, in the
 *  same warning style as DuplicateRecordDialog. "Open existing" is offered only
 *  when the server revealed the record (its read scope covers the caller). */
export function DuplicateWarnings({ duplicates, onOpenExisting, onCreateAnyway }: DuplicateWarningsProps): React.JSX.Element {
  return (
    <div role="alert" className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 dark:bg-amber-500/10">
          <TriangleAlert className="size-4 text-warning dark:text-amber-400" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">This document may already be in StoneSuite</h3>
      </div>
      <ul className="space-y-2">
        {duplicates.map((d, i) => {
          const uuid = d.recordUuid;
          return (
            <li key={`${d.kind}-${uuid ?? i}`} className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-white/[0.03] p-3 text-xs text-stone-700 dark:text-stone-300">
              <p>{d.reason}</p>
              {(d.number || d.status) && (
                <p className="mt-0.5 text-stone-500 dark:text-stone-400">
                  {[d.number, d.status && duplicateStatusText(d.status)].filter(Boolean).join(' · ')}
                </p>
              )}
              {uuid && (
                <button
                  type="button"
                  onClick={() => onOpenExisting(uuid)}
                  aria-label={d.number ? `Open existing ${d.number}` : undefined}
                  className="mt-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
                >
                  Open existing
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCreateAnyway}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 transition-all hover:bg-brand-hover active:scale-95"
        >
          Create anyway
        </button>
      </div>
    </div>
  );
}
