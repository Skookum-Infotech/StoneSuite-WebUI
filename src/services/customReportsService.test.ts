import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { customReportsService } from './customReportsService';
import type { CustomReportDefinition } from '@/types/customReports';

const DEFINITION: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [],
  groupBy: { field: 'customer.name' },
  totals: [{ fn: 'sum', field: 'net_amount' }],
  chart: 'bar',
};

const REPORT_WIRE = {
  id: 'r-1',
  name: 'Revenue by customer',
  definition: DEFINITION,
  shared: false,
  ownerName: 'Pat Doe',
  isMine: true,
  updatedAt: '2026-11-06T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('customReportsService', () => {
  it('catalog GETs the catalog and unwraps the sources', async () => {
    const sources = [{ key: 'invoice_lines', label: 'Invoice lines', module: 'sales', fields: [] }];
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, sources } });
    await expect(customReportsService.catalog()).resolves.toEqual(sources);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/reports/custom/catalog');
  });

  it('run POSTs the definition without a limit unless one is given', async () => {
    const result = { columns: [], rows: [], totals: [], rowCount: 0, truncated: false };
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, result } });
    await expect(customReportsService.run(DEFINITION)).resolves.toEqual(result);
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/reports/custom/run', { definition: DEFINITION });

    await customReportsService.run(DEFINITION, 10000);
    expect(tenantClient.post).toHaveBeenLastCalledWith('/tenant/reports/custom/run', {
      definition: DEFINITION,
      limit: 10000,
    });
  });

  it('run forwards an AbortSignal so a superseded preview can be cancelled', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, result: { columns: [], rows: [], totals: [], rowCount: 0, truncated: false } } });
    const controller = new AbortController();
    await customReportsService.run(DEFINITION, undefined, controller.signal);
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/reports/custom/run', { definition: DEFINITION }, { signal: controller.signal });
  });

  it('list GETs the reports and unwraps them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, reports: [REPORT_WIRE] } });
    await expect(customReportsService.list()).resolves.toEqual([REPORT_WIRE]);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/reports/custom');
  });

  it('list turns a null list into an empty one', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, reports: null } });
    await expect(customReportsService.list()).resolves.toEqual([]);
  });

  it('get, create, update, remove and copy use the right verb and URL', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, report: REPORT_WIRE } });
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, report: REPORT_WIRE } });
    vi.mocked(tenantClient.put).mockResolvedValue({ data: { success: true, report: REPORT_WIRE } });
    vi.mocked(tenantClient.delete).mockResolvedValue({ data: { success: true } });

    await expect(customReportsService.get('r-1')).resolves.toEqual(REPORT_WIRE);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/reports/custom/r-1');

    const body = { name: 'Revenue by customer', definition: DEFINITION, shared: true };
    await expect(customReportsService.create(body)).resolves.toEqual(REPORT_WIRE);
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/reports/custom', body);

    await expect(customReportsService.update('r-1', body)).resolves.toEqual(REPORT_WIRE);
    expect(tenantClient.put).toHaveBeenCalledWith('/tenant/reports/custom/r-1', body);

    await expect(customReportsService.remove('r-1')).resolves.toBeUndefined();
    expect(tenantClient.delete).toHaveBeenCalledWith('/tenant/reports/custom/r-1');

    await expect(customReportsService.copy('r-1')).resolves.toEqual(REPORT_WIRE);
    expect(tenantClient.post).toHaveBeenLastCalledWith('/tenant/reports/custom/r-1/copy');
  });

  it('a definition the server stored with null lists comes back with empty ones', async () => {
    const sparse = { ...REPORT_WIRE, definition: { source: 'invoice_lines', columns: null, filters: null, totals: null, chart: 'none' } };
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, report: sparse } });
    const report = await customReportsService.get('r-1');
    expect(report.definition.columns).toEqual([]);
    expect(report.definition.filters).toEqual([]);
    expect(report.definition.totals).toEqual([]);
  });

  it('interpret POSTs the prompt (and the current report when editing) and unwraps the interpretation', async () => {
    const interpretation = { definition: DEFINITION, summary: 'Revenue by customer', dropped: [] };
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, interpretation } });

    await expect(customReportsService.interpret('top customers')).resolves.toEqual(interpretation);
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/reports/custom/interpret', { prompt: 'top customers' });

    await customReportsService.interpret('only paid', DEFINITION);
    expect(tenantClient.post).toHaveBeenLastCalledWith('/tenant/reports/custom/interpret', {
      prompt: 'only paid',
      current: DEFINITION,
    });
  });
});
