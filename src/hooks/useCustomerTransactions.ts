import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { customerTransactionsService } from '@/services/customerTransactionsService';
import type { CustomerTransactionFilters } from '@/types/customerTransactions';

// Fresher than the app-wide default: the feed should reflect the document the
// user just created or edited, not a copy from two minutes ago.
const STALE_MS = 10_000;

/** Query keys; `all(id)` invalidates the list and the summary together. */
export const customerTransactionsKeys = {
  all: (id: string) => ['customer-transactions', id] as const,
  list: (id: string, filters: CustomerTransactionFilters, limit: number) =>
    ['customer-transactions', id, 'list', filters, filters.page, limit] as const,
  summary: (id: string) => ['customer-transactions', id, 'summary'] as const,
};

/** One page of the customer's transactions; keeps the old rows while the next loads. */
export function useCustomerTransactionsList(
  customerId: string | undefined,
  filters: CustomerTransactionFilters,
  limit: number,
) {
  return useQuery({
    queryKey: customerTransactionsKeys.list(customerId ?? '', filters, limit),
    queryFn: () => customerTransactionsService.list(customerId ?? '', { ...filters, limit }),
    enabled: Boolean(customerId),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** AR summary, per-type counts and readable types — independent of filters and page. */
export function useCustomerTransactionsSummary(customerId: string | undefined) {
  return useQuery({
    queryKey: customerTransactionsKeys.summary(customerId ?? ''),
    queryFn: () => customerTransactionsService.summary(customerId ?? ''),
    enabled: Boolean(customerId),
    staleTime: STALE_MS,
  });
}
