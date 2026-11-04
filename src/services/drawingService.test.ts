import { describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { Drawing } from '@/types/drawing';

vi.mock('@/api/tenantClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tenantClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { DrawingConflictError, drawingService } from './drawingService';

const DRAWING: Drawing = {
  schemaVersion: 1,
  salesOrderId: 'so1',
  version: 1,
  displayUnit: 'in',
  fractionDenominator: 32,
  areas: [],
  updatedAt: '2026-11-03T00:00:00.000Z',
  updatedBy: { id: 'u1', name: 'Test User' },
};

describe('drawingService.getDrawing', () => {
  it('returns the drawing on success', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, drawing: DRAWING } });
    expect(await drawingService.getDrawing('so1')).toEqual(DRAWING);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing');
  });

  it('returns null on a 404', async () => {
    const err = new AxiosError('Not found');
    err.response = { status: 404, data: {} } as AxiosError['response'];
    vi.mocked(tenantClient.get).mockRejectedValue(err);
    expect(await drawingService.getDrawing('so1')).toBeNull();
  });

  it('rethrows any other error', async () => {
    vi.mocked(tenantClient.get).mockRejectedValue(new Error('network down'));
    await expect(drawingService.getDrawing('so1')).rejects.toThrow('network down');
  });
});

function conflict409() {
  const err = new AxiosError('Conflict');
  err.response = { status: 409, data: {} } as AxiosError['response'];
  return err;
}

describe('drawingService.saveDrawing', () => {
  const payload = { areas: DRAWING.areas, displayUnit: DRAWING.displayUnit, fractionDenominator: DRAWING.fractionDenominator, recordVersion: 1 };

  it('PUTs the payload and returns the saved drawing', async () => {
    vi.mocked(tenantClient.put).mockResolvedValue({ data: { success: true, drawing: DRAWING } });
    expect(await drawingService.saveDrawing('so1', payload)).toEqual(DRAWING);
    expect(tenantClient.put).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing', payload);
  });

  it('throws DrawingConflictError specifically on a 409', async () => {
    vi.mocked(tenantClient.put).mockRejectedValue(conflict409());
    await expect(drawingService.saveDrawing('so1', payload)).rejects.toBeInstanceOf(DrawingConflictError);
  });

  it('rethrows any other error', async () => {
    vi.mocked(tenantClient.put).mockRejectedValue(new Error('network down'));
    await expect(drawingService.saveDrawing('so1', payload)).rejects.toThrow('network down');
  });
});

describe('drawingService.listVersions', () => {
  it('GETs the versions page', async () => {
    const page = { items: [{ version: 1, updatedAt: DRAWING.updatedAt, updatedBy: DRAWING.updatedBy }], nextCursor: null };
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, ...page } });
    expect(await drawingService.listVersions('so1')).toEqual(page);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing/versions', { params: { cursor: undefined } });
  });

  it('passes a cursor through unchanged', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, items: [], nextCursor: null } });
    await drawingService.listVersions('so1', 'abc');
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing/versions', { params: { cursor: 'abc' } });
  });
});

describe('drawingService.getVersion', () => {
  it('GETs one version', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, drawing: DRAWING } });
    expect(await drawingService.getVersion('so1', 2)).toEqual(DRAWING);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing/versions/2');
  });
});

describe('drawingService.restoreVersion', () => {
  it('POSTs the restore and returns the new drawing', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, drawing: DRAWING } });
    expect(await drawingService.restoreVersion('so1', 1, 2)).toEqual(DRAWING);
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/sales-orders/so1/drawing/versions/1/restore', { recordVersion: 2 });
  });

  it('throws DrawingConflictError specifically on a 409', async () => {
    vi.mocked(tenantClient.post).mockRejectedValue(conflict409());
    await expect(drawingService.restoreVersion('so1', 1, 2)).rejects.toBeInstanceOf(DrawingConflictError);
  });
});

describe('drawingService.getEdgeCodes', () => {
  it('GETs the edge code list', async () => {
    const edgeCodes = [{ code: 'EE', label: 'Eased Edge' }];
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, edgeCodes } });
    expect(await drawingService.getEdgeCodes()).toEqual(edgeCodes);
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/settings/edge-codes');
  });
});
