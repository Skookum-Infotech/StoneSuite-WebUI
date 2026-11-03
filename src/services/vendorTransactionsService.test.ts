import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { vendorTransactionsService, toParams } from './vendorTransactionsService';
import type { VendorTransactionsQuery } from '@/types/vendorTransactions';

const get = vi.mocked(tenantClient.get);

describe('toParams', () => {
  const cases: { name: string; query: VendorTransactionsQuery; want: Record<string, string | number> }[] = [
    { name: 'empty query', query: {}, want: {} },
    {
      name: 'defaults are dropped',
      query: { type: '', status: '', from: '', to: '', q: '  ', open: false, cursor: '' },
      want: {},
    },
    { name: 'open becomes the string true', query: { open: true }, want: { open: 'true' } },
    { name: 'cursor is passed through untouched', query: { cursor: 'a+b/c==', limit: 50 }, want: { cursor: 'a+b/c==', limit: 50 } },
    { name: 'q is trimmed', query: { q: ' BILL-1 ' }, want: { q: 'BILL-1' } },
    {
      name: 'everything set',
      query: { type: 'vendor_bill', status: 'APPV', from: '2026-01-01', to: '2026-10-31', open: true, cursor: 'c', limit: 25 },
      want: { type: 'vendor_bill', status: 'APPV', from: '2026-01-01', to: '2026-10-31', open: 'true', cursor: 'c', limit: 25 },
    },
  ];
  it.each(cases)('$name', ({ query, want }) => {
    expect(toParams(query)).toEqual(want);
  });
});

describe('vendorTransactionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list encodes the id, sends only real params and normalises nulls', async () => {
    get.mockResolvedValue({ data: { success: true, rows: null, nextCursor: null, limit: 25 } });
    const page = await vendorTransactionsService.list('a/b c', { type: 'vendor_bill', cursor: '' });
    expect(get).toHaveBeenCalledWith('/tenant/vendors/a%2Fb%20c/transactions', { params: { type: 'vendor_bill' } });
    expect(page).toEqual({ rows: [], nextCursor: '', limit: 25 });
  });

  it('summary normalises missing arrays', async () => {
    get.mockResolvedValue({ data: { success: true, summary: { openBalance: null }, counts: null, types: null, scopeLimited: undefined } });
    const ov = await vendorTransactionsService.summary('v-1');
    expect(get).toHaveBeenCalledWith('/tenant/vendors/v-1/transactions/summary');
    expect(ov).toMatchObject({ counts: [], types: [], scopeLimited: false });
  });
});
