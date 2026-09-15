import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Regression coverage for the role-switch live-refresh bug: after a role
// switch, every already-mounted role-scoped query (Dashboard widgets,
// NotificationBell, etc.) must refetch immediately, not just once its own
// poll interval or the next component render happens to roll around.
//
// queryClient.clear() only deletes cached Query objects — it never calls a
// still-mounted query's queryFn itself. An active observer only notices the
// removal (and re-fetches) the next time ITS OWN render or refetchInterval
// fires, which a role switch does not itself cause for a query whose owning
// component has no other reason to re-render (e.g. a Dashboard widget behind
// <Outlet/>, unrelated to the auth-store fields a role switch changes).
// queryClient.invalidateQueries() is the API that explicitly re-fetches every
// currently active query — that's the one role-switch handlers must call.
describe('refetching an already-mounted query after a cache invalidation', () => {
  function mountQuery() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fetchSpy = vi.fn().mockResolvedValue('widget-data');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useQuery({ queryKey: ['dashboard-widget-catalog'], queryFn: fetchSpy }),
      { wrapper },
    );
    return { queryClient, fetchSpy, result };
  }

  it('clear() does not refetch a mounted query that has no reason to re-render', async () => {
    const { queryClient, fetchSpy, result } = mountQuery();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    queryClient.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('invalidateQueries() refetches a mounted query immediately', async () => {
    const { queryClient, fetchSpy, result } = mountQuery();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await queryClient.invalidateQueries();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
