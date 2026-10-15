import { useEffect } from 'react';
import { useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { PENDING_DOCUMENTS_KEY } from '@/lib/documentExtractionKeys';
import { documentExtractionService } from '@/services/documentExtractionService';
import { IN_FLIGHT_STATUSES } from '@/types/documentExtraction';

// "Continue in background" closes the upload dialog, which stops the only
// poller for that extraction — so the Pending documents chip wouldn't learn it
// finished until a reload. The ids are kept in the query cache (shared by every
// page's chip) and watched here until they leave the in-flight statuses.

/** Slower than the dialog's poll: nobody is watching a spinner. */
const BACKGROUND_POLL_MS = 5000;
const BACKGROUND_EXTRACTIONS_KEY = ['document-extractions', 'background'] as const;

/** Remembers an extraction the user sent to the background so a chip watches it. */
export function trackBackgroundExtraction(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<string[]>(BACKGROUND_EXTRACTIONS_KEY, (prev = []) => (prev.includes(id) ? prev : [...prev, id]));
}

function untrack(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<string[]>(BACKGROUND_EXTRACTIONS_KEY, (prev = []) => prev.filter((x) => x !== id));
}

/** Polls the backgrounded extractions; when one finishes (or can no longer be
 *  read) it stops watching it and refreshes the pending-documents list. */
export function useBackgroundExtractionWatch(enabled: boolean): void {
  const queryClient = useQueryClient();
  const { data: ids = [] } = useQuery({
    queryKey: BACKGROUND_EXTRACTIONS_KEY,
    queryFn: () => queryClient.getQueryData<string[]>(BACKGROUND_EXTRACTIONS_KEY) ?? [],
    initialData: [],
    staleTime: Infinity,
  });
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['document-extraction', id, 'background'] as const,
      queryFn: () => documentExtractionService.get(id),
      enabled,
      retry: false,
      refetchInterval: (q: { state: { data?: { status: string } } }) => {
        const status = q.state.data?.status;
        return !status || (IN_FLIGHT_STATUSES as readonly string[]).includes(status) ? BACKGROUND_POLL_MS : false;
      },
    })),
  });
  // One string per poll outcome, so the effect re-runs only when one settles.
  const settled = results.map((r, i) => {
    const done = r.isError || (r.data !== undefined && !IN_FLIGHT_STATUSES.includes(r.data.status));
    return done ? ids[i] : '';
  }).filter(Boolean).join(',');
  useEffect(() => {
    if (!settled) return;
    for (const id of settled.split(',')) untrack(queryClient, id);
    void queryClient.invalidateQueries({ queryKey: PENDING_DOCUMENTS_KEY });
  }, [settled, queryClient]);
}
