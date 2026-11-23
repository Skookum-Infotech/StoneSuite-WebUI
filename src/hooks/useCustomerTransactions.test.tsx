import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/customerTransactionsService', () => ({
  customerTransactionsService: { list: vi.fn(), summary: vi.fn() },
}));

import { customerTransactionsService } from '@/services/customerTransactionsService';
import {
  customerTransactionsKeys, useCustomerTransactionsList, useCustomerTransactionsSummary,
} from './useCustomerTransactions';
import { EMPTY_FILTERS } from '@/lib/customerTransactions';

const list = vi.mocked(customerTransactionsService.list);
const summary = vi.mocked(customerTransactionsService.summary);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('customerTransactionsKeys', () => {
  it('list and summary keys share the all() prefix', () => {
    const all = customerTransactionsKeys.all('c1');
    expect(customerTransactionsKeys.list('c1', EMPTY_FILTERS, 25).slice(0, 2)).toEqual(all);
    expect(customerTransactionsKeys.summary('c1').slice(0, 2)).toEqual(all);
  });

  it('the list key varies with filters, page and limit', () => {
    const a = customerTransactionsKeys.list('c1', EMPTY_FILTERS, 25);
    expect(customerTransactionsKeys.list('c1', { ...EMPTY_FILTERS, type: 'invoice' }, 25)).not.toEqual(a);
    expect(customerTransactionsKeys.list('c1', { ...EMPTY_FILTERS, page: 2 }, 25)).not.toEqual(a);
    expect(customerTransactionsKeys.list('c1', EMPTY_FILTERS, 50)).not.toEqual(a);
  });
});

describe('hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('are disabled without a customer id', () => {
    renderHook(() => useCustomerTransactionsList(undefined, EMPTY_FILTERS, 25), { wrapper });
    renderHook(() => useCustomerTransactionsSummary(undefined), { wrapper });
    expect(list).not.toHaveBeenCalled();
    expect(summary).not.toHaveBeenCalled();
  });

  it('list passes the filters and limit to the service', async () => {
    list.mockResolvedValue({ rows: [], total: 0, page: 1, limit: 25 });
    const f = { ...EMPTY_FILTERS, type: 'invoice', page: 2 };
    const { result } = renderHook(() => useCustomerTransactionsList('c1', f, 25), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith('c1', { ...f, limit: 25 });
  });
});
