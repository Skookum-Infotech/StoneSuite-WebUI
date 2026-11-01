import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { vendorTransactionsService } from '@/services/vendorTransactionsService';
import type { VendorTransactionFilters } from '@/types/vendorTransactions';

// Fresher than the app-wide default: the feed should reflect the document the
// user just created or edited, not a copy from two minutes ago.
const STALE_MS = 10_000;

/** Query keys; `all(id)` invalidates the list and the summary together. */
export const vendorTransactionsKeys = {
  all: (id: string) => ['vendor-transactions', id] as const,
  list: (id: string, filters: VendorTransactionFilters, limit: number) =>
    ['vendor-transactions', id, 'list', filters, limit] as const,
  summary: (id: string) => ['vendor-transactions', id, 'summary'] as const,
};

/** One page of the vendor's transactions; keeps the old rows while the next loads. */
export function useVendorTransactionsList(
  vendorId: string | undefined,
  filters: VendorTransactionFilters,
  limit: number,
) {
  return useQuery({
    queryKey: vendorTransactionsKeys.list(vendorId ?? '', filters, limit),
    queryFn: () => vendorTransactionsService.list(vendorId ?? '', { ...filters, limit }),
    enabled: Boolean(vendorId),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** AP summary, per-type counts and readable types — independent of filters and page. */
export function useVendorTransactionsSummary(vendorId: string | undefined) {
  return useQuery({
    queryKey: vendorTransactionsKeys.summary(vendorId ?? ''),
    queryFn: () => vendorTransactionsService.summary(vendorId ?? ''),
    enabled: Boolean(vendorId),
    staleTime: STALE_MS,
  });
}
