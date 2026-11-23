import { MutationCache, QueryClient } from '@tanstack/react-query';

/** Query keys of every detail page that shows the Progress Bar card. */
export const WORKFLOW_DETAIL_QUERY_KEYS: ReadonlySet<string> = new Set([
  'quote', 'sales-order', 'fabrication-job', 'invoice', 'payment', 'refund',
  'requisition', 'purchase-order', 'item-receipt', 'vendor-bill', 'vendor-payment',
]);

export const queryClient: QueryClient = new QueryClient({
  // Any successful change (a convert, a status move, a new payment) can add or
  // advance a record elsewhere in the flow. Mark every cached workflow record
  // stale so the card on each page refetches, now if the page is open, or on
  // next visit instead of waiting out the 2-minute staleTime below.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && WORKFLOW_DETAIL_QUERY_KEYS.has(q.queryKey[0]),
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Treat all data as fresh for 2 minutes — prevents re-fetching the same
      // endpoint when navigating away and back within a normal work session.
      staleTime: 2 * 60 * 1000,
    },
  },
});
