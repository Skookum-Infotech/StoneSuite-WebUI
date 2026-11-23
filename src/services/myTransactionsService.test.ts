import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { myTransactionsService, toParams } from './myTransactionsService';

describe('toParams', () => {
  it.each([
    ['nothing set', {}, {}],
    ['default role is not sent', { role: 'all' as const }, {}],
    ['a real role is sent', { role: 'created' as const }, { role: 'created' }],
    ['blank type and search are dropped', { type: '', q: '   ' }, {}],
    ['search is trimmed', { q: '  acme ' }, { q: 'acme' }],
    ['page 1 is the default and is not sent', { page: 1 }, {}],
    ['a later page is sent', { page: 3 }, { page: 3 }],
    [
      'everything together',
      { role: 'updated' as const, type: 'invoice', q: 'x', page: 2, limit: 25 },
      { role: 'updated', type: 'invoice', q: 'x', page: 2, limit: 25 },
    ],
  ])('%s', (_name, input, expected) => {
    expect(toParams(input)).toEqual(expected);
  });
});

describe('myTransactionsService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests the endpoint with only the real filters and maps the page', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, rows: [{ type: 'invoice', id: 'i-1' }], total: 61, page: 2, limit: 25 },
    });

    const page = await myTransactionsService.list({ role: 'created', type: 'invoice', page: 2, limit: 25 });

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/my-transactions', {
      params: { role: 'created', type: 'invoice', page: 2, limit: 25 },
    });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(61);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(25);
  });

  it('tolerates a null row list (an empty page)', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, rows: null, total: 0, page: 1, limit: 25 },
    });

    const page = await myTransactionsService.list({});

    expect(page).toEqual({ rows: [], total: 0, page: 1, limit: 25 });
  });
});

describe('myTransactionsService.overview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the unfiltered summary and readable types', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        summary: { total: 3, created: 2, updated: 1, recent: 3 },
        types: [{ type: 'invoice', label: 'Invoice', domain: 'sales' }],
      },
    });

    const overview = await myTransactionsService.overview();

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/my-transactions/summary');
    expect(overview.summary).toEqual({ total: 3, created: 2, updated: 1, recent: 3 });
    expect(overview.types).toEqual([{ type: 'invoice', label: 'Invoice', domain: 'sales' }]);
  });

  it('defaults a null type list to empty', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, summary: { total: 0, created: 0, updated: 0, recent: 0 }, types: null },
    });

    expect((await myTransactionsService.overview()).types).toEqual([]);
  });
});
