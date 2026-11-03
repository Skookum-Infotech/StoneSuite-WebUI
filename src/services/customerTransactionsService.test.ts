import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { customerTransactionsService, toParams } from './customerTransactionsService';
import type { CustomerTransactionsQuery } from '@/types/customerTransactions';

const get = vi.mocked(tenantClient.get);

describe('toParams', () => {
  const cases: { name: string; query: CustomerTransactionsQuery; want: Record<string, string | number> }[] = [
    { name: 'empty query', query: {}, want: {} },
    {
      name: 'defaults are dropped',
      query: { type: '', status: '', from: '', to: '', q: '  ', open: false, page: 1 },
      want: {},
    },
    { name: 'open becomes the string true', query: { open: true }, want: { open: 'true' } },
    { name: 'page > 1 is kept', query: { page: 3, limit: 50 }, want: { page: 3, limit: 50 } },
    { name: 'q is trimmed', query: { q: ' INV-1 ' }, want: { q: 'INV-1' } },
    {
      name: 'everything set',
      query: { type: 'invoice', status: 'SENT', from: '2026-01-01', to: '2026-10-31', open: true, page: 2, limit: 25 },
      want: { type: 'invoice', status: 'SENT', from: '2026-01-01', to: '2026-10-31', open: 'true', page: 2, limit: 25 },
    },
  ];
  it.each(cases)('$name', ({ query, want }) => {
    expect(toParams(query)).toEqual(want);
  });
});

describe('customerTransactionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list encodes the id and sends only real params', async () => {
    get.mockResolvedValue({ data: { success: true, rows: [], total: 0, page: 1, limit: 25 } });
    await customerTransactionsService.list('a/b c', { type: 'invoice', page: 1 });
    expect(get).toHaveBeenCalledWith('/tenant/crm/customer/records/a%2Fb%20c/transactions', {
      params: { type: 'invoice' },
    });
  });

  it('list turns null rows into an empty array', async () => {
    get.mockResolvedValue({ data: { success: true, rows: null, total: 0, page: 1, limit: 25 } });
    const page = await customerTransactionsService.list('c-1', {});
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('summary hits /summary and normalises null lists', async () => {
    get.mockResolvedValue({
      data: {
        success: true, scopeLimited: true, counts: null, types: null,
        summary: { openBalance: 4, openInvoiceCount: 1, overdueBalance: null, overdueInvoiceCount: null,
          unappliedCredits: null, billed12m: null, paid12m: null, lastActivityAt: null },
      },
    });
    const o = await customerTransactionsService.summary('c-1');
    expect(get).toHaveBeenCalledWith('/tenant/crm/customer/records/c-1/transactions/summary');
    expect(o.counts).toEqual([]);
    expect(o.types).toEqual([]);
    expect(o.scopeLimited).toBe(true);
    expect(o.summary.openBalance).toBe(4);
  });
});
