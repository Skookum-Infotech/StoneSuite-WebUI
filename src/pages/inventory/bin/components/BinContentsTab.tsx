import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Layers, Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { Badge, ErrorNote, Spinner } from '@/components/tenant/ui';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_RESERVED } from '@/types/inventory';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  [UNIT_STATUS_AVAILABLE]: '#22c55e',
  [UNIT_STATUS_RESERVED]: '#f59e0b',
};

// What is in the bin right now: the slabs whose bin it is, available or held for
// a job. Consumed and scrapped slabs are history, not contents.
export function BinContentsTab({ binId }: { binId: string }) {
  const navigate = useNavigate();

  const q = useInfiniteQuery({
    queryKey: ['inventory-units', 'in-bin', binId],
    queryFn: ({ pageParam }) => inventoryUnitService.searchUnits({
      filters: [
        { field: 'bin_id', op: 'eq', value: binId },
        { field: 'status', op: 'in', value: [UNIT_STATUS_AVAILABLE, UNIT_STATUS_RESERVED] },
      ],
      sort: [{ field: 'serial', dir: 'asc' }],
      limit: PAGE_SIZE,
      cursor: pageParam || undefined,
    }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });

  const units = q.data?.pages.flatMap((p) => p.records) ?? [];

  if (q.isLoading) return <Spinner label="Loading bin contents…" />;
  if (q.isError) return <ErrorNote>{apiErrorMessage(q.error, 'Failed to load the slabs in this bin.')}</ErrorNote>;
  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white py-12">
        <div className="rounded-2xl bg-stone-100 p-3"><Layers className="size-5 text-stone-400" aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-stone-700">This bin is empty.</p>
        <p className="text-xs text-stone-400">Slabs appear here once they are moved in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white modal-scrollbar">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="border-b border-stone-200 bg-table-header">
            <tr>
              <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Slab</th>
              <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Item</th>
              <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Area</th>
              <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {units.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-accent/10">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/unit/${u.id}`)}
                    className="font-mono text-xs font-semibold text-stone-900 transition-colors hover:text-accent-foreground"
                  >
                    {u.serial}
                  </button>
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-stone-700">{u.inventoryItemName ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-stone-700">
                  {u.area.toFixed(2)} {u.areaUnitCode ?? ''}
                </td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLORS[u.status] ?? '#a8a29e'}>{u.status.replace('_', ' ')}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {q.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}
            Show more slabs
          </button>
        </div>
      )}
    </div>
  );
}
