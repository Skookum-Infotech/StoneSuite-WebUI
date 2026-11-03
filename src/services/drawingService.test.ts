import { describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { Drawing } from '@/types/drawing';

vi.mock('@/api/tenantClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tenantClient: { get: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { drawingService } from './drawingService';

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
