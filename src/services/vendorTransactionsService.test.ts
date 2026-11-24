import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { AxiosError } from 'axios';
import { vendorTransactionsService, toParams, toExportParams } from './vendorTransactionsService';
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

describe('toExportParams', () => {
  const cases: { name: string; query: VendorTransactionsQuery; want: Record<string, string | number> }[] = [
    { name: 'empty query', query: {}, want: {} },
    { name: 'paging is dropped, the filters stay', query: { type: 'vendor_bill', open: true, cursor: 'abc', limit: 25 }, want: { type: 'vendor_bill', open: 'true' } },
    { name: 'a cursor alone adds nothing', query: { cursor: 'a+b/c==' }, want: {} },
    { name: 'blank filters are still dropped', query: { q: '  ', status: '', limit: 50 }, want: {} },
    {
      name: 'every filter',
      query: { type: 'vendor_bill', status: 'APPV', from: '2026-01-01', to: '2026-10-31', q: ' BILL-1 ', open: true, cursor: 'c', limit: 25 },
      want: { type: 'vendor_bill', status: 'APPV', from: '2026-01-01', to: '2026-10-31', q: 'BILL-1', open: 'true' },
    },
  ];
  it.each(cases)('$name', ({ query, want }) => {
    expect(toExportParams(query)).toEqual(want);
  });
});

describe('vendorTransactionsService.aging', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('reads the aging endpoint for the vendor and returns the buckets as sent', async () => {
    const buckets = [
      { label: 'current', amount: 10, count: 1 },
      { label: '61+', amount: 5, count: 1 },
    ];
    get.mockResolvedValue({ data: { success: true, scopeLimited: true, buckets, total: 15 } });
    await expect(vendorTransactionsService.aging('v 1')).resolves.toEqual({ buckets, total: 15, scopeLimited: true });
    expect(get).toHaveBeenCalledWith('/tenant/vendors/v%201/transactions/aging');
  });

  it('keeps null buckets (the caller cannot read bills) and defaults the rest', async () => {
    get.mockResolvedValue({ data: { success: true, buckets: null } });
    await expect(vendorTransactionsService.aging('v-1')).resolves.toEqual({ buckets: null, total: 0, scopeLimited: false });
  });
});

describe('vendorTransactionsService.exportCsv', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('asks for the file with the filters but not the page cursor or size', async () => {
    const csv = new Blob(['a,b']);
    get.mockResolvedValue({ data: csv });
    await expect(
      vendorTransactionsService.exportCsv('v-1', { type: 'vendor_bill', open: true, cursor: 'abc', limit: 25 }),
    ).resolves.toBe(csv);
    expect(get).toHaveBeenCalledWith('/tenant/vendors/v-1/transactions/export.csv', {
      params: { type: 'vendor_bill', open: 'true' },
      responseType: 'blob',
    });
  });

  it("turns a blob error body back into JSON so the server's message survives", async () => {
    const body = JSON.stringify({ success: false, message: 'Too many transactions to export. Narrow the filters and try again.' });
    const err = new AxiosError('Request failed', '413', undefined, undefined, {
      status: 413, data: new Blob([body]), statusText: '', headers: {}, config: {} as never,
    });
    get.mockRejectedValue(err);
    const caught = await vendorTransactionsService.exportCsv('v-1', {}).catch((e: unknown) => e);
    expect(caught).toBe(err);
    expect((caught as AxiosError).response?.data).toEqual({
      success: false, message: 'Too many transactions to export. Narrow the filters and try again.',
    });
  });

  it('survives a blob error body that is not JSON', async () => {
    const err = new AxiosError('Bad gateway', '502', undefined, undefined, {
      status: 502, data: new Blob(['<html>oops</html>']), statusText: '', headers: {}, config: {} as never,
    });
    get.mockRejectedValue(err);
    const caught = await vendorTransactionsService.exportCsv('v-1', {}).catch((e: unknown) => e);
    expect(caught).toBe(err);
    expect((caught as AxiosError).response?.data).toEqual({});
  });

  it('passes a non-HTTP error through untouched', async () => {
    const boom = new Error('network down');
    get.mockRejectedValue(boom);
    await expect(vendorTransactionsService.exportCsv('v-1', {})).rejects.toBe(boom);
  });
});
