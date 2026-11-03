import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Scissors, Trash2, Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { binEventCounterpart, binEventLabel, binEventTone, type BinEventTone } from '@/lib/binHistoryEvents';
import { cn } from '@/lib/utils';
import type { BinHistoryEntry } from '@/types/inventory';

const PAGE_SIZE = 30;

type Direction = '' | 'in' | 'out';
const FILTERS: { value: Direction; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'in', label: 'Moved in' },
  { value: 'out', label: 'Moved out' },
];

const TONE_STYLES: Record<BinEventTone, string> = {
  in: 'bg-emerald-100 text-emerald-700',
  out: 'bg-sky-100 text-sky-700',
  loss: 'bg-red-100 text-red-700',
  neutral: 'bg-stone-100 text-stone-600',
};

function toneIcon(e: BinHistoryEntry): LucideIcon {
  if (e.action === 'scrap') return Trash2;
  if (e.action === 'cut') return Scissors;
  if (e.direction === 'in') return ArrowDownToLine;
  if (e.direction === 'out') return ArrowUpFromLine;
  return Activity;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// Every slab that has been moved into this bin, moved out of it, cut or scrapped
// from it — newest first, each with who did it, when, and the Bin Transfer it
// belonged to. Read from the units' own movement history, so it also shows moves
// that did not come from a transfer (fabrication WIP, receipts, bundles).
export function BinHistoryTab({ binId }: { binId: string }) {
  const navigate = useNavigate();
  const [direction, setDirection] = useState<Direction>('');

  const q = useInfiniteQuery({
    queryKey: ['inventory-bin-history', binId, direction],
    queryFn: ({ pageParam }) => inventoryBinService.getHistory(binId, {
      cursor: pageParam || undefined,
      direction: direction || undefined,
      limit: PAGE_SIZE,
    }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });

  const entries = q.data?.pages.flatMap((p) => p.records) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter movement history">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setDirection(f.value)}
            aria-pressed={direction === f.value}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
              direction === f.value
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading && <Spinner label="Loading movement history…" />}
      {q.isError && <ErrorNote>{apiErrorMessage(q.error, 'Failed to load this bin’s history.')}</ErrorNote>}

      {!q.isLoading && !q.isError && entries.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white py-12 text-center text-sm text-stone-500">
          {direction ? 'Nothing matches that filter yet.' : 'No slab has been moved into or out of this bin yet.'}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {entries.map((e, i) => {
            const Icon = toneIcon(e);
            const counterpart = binEventCounterpart(e);
            return (
              <li key={`${e.at}-${e.unitId}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', TONE_STYLES[binEventTone(e)])}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-800">
                    <span className="font-semibold">{binEventLabel(e)}</span>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => navigate(`/inventory/unit/${e.unitId}`)}
                      className="font-mono font-semibold text-stone-900 transition-colors hover:text-accent-foreground"
                    >
                      {e.unitSerial}
                    </button>
                    {counterpart && <span className="text-stone-500"> {counterpart}</span>}
                  </p>
                  <p className="text-2xs text-stone-500">
                    {e.inventoryItemName && <>{e.inventoryItemName} · </>}
                    {fmtDateTime(e.at)} · {e.byName}
                    {e.transferNumber && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory/bin_transfer/${e.transferId}`)}
                          className="font-mono font-semibold text-stone-600 transition-colors hover:text-accent-foreground"
                        >
                          {e.transferNumber}
                        </button>
                      </>
                    )}
                  </p>
                  {e.note && <p className="mt-0.5 text-2xs text-stone-500">{e.note}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {q.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {q.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}
            Show earlier activity
          </button>
        </div>
      )}
    </div>
  );
}
