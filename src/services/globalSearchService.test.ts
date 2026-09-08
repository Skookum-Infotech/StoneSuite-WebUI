import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({ tenantClient: { get: vi.fn() } }));

import { globalSearchService } from './globalSearchService';
import { tenantClient } from '@/api/tenantClient';

const mockGet = vi.mocked(tenantClient.get);

beforeEach(() => vi.clearAllMocks());

describe('globalSearchService.search', () => {
  it('calls GET /tenant/search with q and normalizes the payload', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, query: 'acme', groups: { customer: { results: [], hasMore: false } } },
    } as never);

    const res = await globalSearchService.search('acme');

    expect(mockGet).toHaveBeenCalledWith('/tenant/search', { params: { q: 'acme' } });
    expect(res.query).toBe('acme');
    expect(res.groups.customer).toEqual({ results: [], hasMore: false });
  });

  it('passes modules and limit through as query params', async () => {
    mockGet.mockResolvedValue({ data: { success: true, query: 'x', groups: {} } } as never);

    await globalSearchService.search('x', { modules: ['invoice', 'payment'], limit: 50 });

    expect(mockGet).toHaveBeenCalledWith('/tenant/search', {
      params: { q: 'x', modules: 'invoice,payment', limit: '50' },
    });
  });

  it('defaults groups to {} when the server omits them', async () => {
    mockGet.mockResolvedValue({ data: { success: true, query: 'x' } } as never);
    const res = await globalSearchService.search('x');
    expect(res.groups).toEqual({});
  });
});
