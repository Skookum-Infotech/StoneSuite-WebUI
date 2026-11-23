import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, RefreshCw } from 'lucide-react';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { replenishmentService } from '@/services/replenishmentService';
import { REORDER_QUERY_KEY, monthsPhrase, type CreatedBatch } from '@/lib/replenishment';
import { CreatedOrdersBanner } from './components/CreatedOrdersBanner';
import { ReorderItemCard } from './components/ReorderItemCard';

export default function ReorderPage() {
  const [created, setCreated] = useState<CreatedBatch[]>([]);
  // The list is worked out from live stock, usage and POs, so it is never
  // served from the app's 2-minute cache: opening the page recalculates.
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: [REORDER_QUERY_KEY],
    queryFn: () => replenishmentService.list(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const items = data?.items ?? [];

  return (
    <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
            <PackagePlus className="size-5 text-accent-foreground" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Reorder</h1>
            <p className="text-sm text-stone-500">
              Items the open POs and stock on hand won't cover next month, based on what was
              used{data && data.months.length > 0 ? ` in ${monthsPhrase(data.months)}` : ' recently'}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-2xs text-stone-500">Computed {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-stone-900 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={isFetching ? 'size-3.5 motion-safe:animate-spin' : 'size-3.5'} aria-hidden="true" />
            Compute
          </button>
        </div>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto border-t border-stone-100 pt-4">
        <CreatedOrdersBanner
          batches={created}
          onDismiss={(key) => setCreated((prev) => prev.filter((b) => b.key !== key))}
        />
        {isLoading && <Spinner label="Working out what to reorder…" />}
        {error && <ErrorNote>{apiErrorMessage(error, 'Failed to load reorder suggestions.')}</ErrorNote>}
        {!isLoading && !error && items.length === 0 && (
          <p className="py-10 text-center text-sm text-stone-500">
            Nothing needs reordering. Stock and open POs cover next month's usage.
          </p>
        )}
        <div className="space-y-4">
          {items.map((item) => (
            <ReorderItemCard
              key={`${item.inventoryItemId}-${item.onOrder}-${item.needed}`}
              item={item}
              onCreated={(batch) => setCreated((prev) => [batch, ...prev])}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
