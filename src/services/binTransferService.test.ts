import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { binTransferService } from './binTransferService';

const BASE = '/tenant/inventory/bin-transfers';

describe('binTransferService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('search posts the request and normalises the page', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: { success: true, scope: 'all', records: [{ id: 'bt-1' }], nextCursor: 'abc', hasMore: true },
    });

    const page = await binTransferService.search({ search: 'SLB', limit: 25 });

    expect(tenantClient.post).toHaveBeenCalledWith(`${BASE}/search`, { search: 'SLB', limit: 25 });
    expect(page).toEqual({ records: [{ id: 'bt-1' }], nextCursor: 'abc', hasMore: true, scope: 'all' });
  });

  it('search copes with a bare response', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });

    expect(await binTransferService.search({})).toEqual({ records: [], nextCursor: '', hasMore: false, scope: '' });
  });

  it('get overlays the approval fields the server sends beside the record', async () => {
    const approval = {
      gated: true, approvers: [{ id: '1', name: 'Sam', approved: false }], requiredApprovals: 2, approvedCount: 1,
      canApprove: true, isOverride: false, callerAlreadyApproved: false, canReject: true,
    };
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, binTransfer: { id: 'bt-1', number: 'BTRF-000012' }, approval },
    });

    const bt = await binTransferService.get('bt-1');

    expect(tenantClient.get).toHaveBeenCalledWith(`${BASE}/bt-1`);
    expect(bt).toMatchObject({ id: 'bt-1', number: 'BTRF-000012', gated: true, requiredApprovals: 2, approvedCount: 1, canApprove: true, canReject: true });
    expect(bt.approvers).toEqual(approval.approvers);
  });

  it('get defaults to "not gated, nothing to approve" when no approval comes back', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, binTransfer: { id: 'bt-1' } } });

    const bt = await binTransferService.get('bt-1');

    expect(bt).toMatchObject({ gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0, canApprove: false, canReject: false });
    expect(bt.rejection).toBeUndefined();
  });

  it('get surfaces a rejection so the red banner can say why', async () => {
    const rejection = { byName: 'Sam', reason: 'Rack is closed', at: '2026-10-14T09:00:00' };
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, binTransfer: { id: 'bt-1' }, approval: { gated: false, rejection } },
    });

    expect((await binTransferService.get('bt-1')).rejection).toEqual(rejection);
  });

  it('create posts the input and returns the transfer', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, binTransfer: { id: 'bt-9' } } });
    const input = { warehouseId: 1, lines: [{ unitId: 'u-1', toBinId: 'b-1' }] };

    const bt = await binTransferService.create(input);

    expect(tenantClient.post).toHaveBeenCalledWith(BASE, input);
    expect(bt).toEqual({ id: 'bt-9' });
  });

  it('update patches the draft', async () => {
    vi.mocked(tenantClient.patch).mockResolvedValue({ data: { success: true, binTransfer: { id: 'bt-1' } } });
    const input = { warehouseId: 1, notes: 'x', lines: [] };

    await binTransferService.update('bt-1', input);

    expect(tenantClient.patch).toHaveBeenCalledWith(`${BASE}/bt-1`, input);
  });

  it('transition names the target status and carries a note', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, binTransfer: { id: 'bt-1' } } });

    await binTransferService.transition('bt-1', 'CANC', 'Customer changed the order');

    expect(tenantClient.post).toHaveBeenCalledWith(`${BASE}/bt-1/transition`, { toStatusCode: 'CANC', note: 'Customer changed the order' });
  });

  it('approve, reject and complete hit their own endpoints', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, binTransfer: { id: 'bt-1' } } });

    await binTransferService.approve('bt-1');
    await binTransferService.reject('bt-1', 'Rack is closed');
    await binTransferService.complete('bt-1');

    expect(tenantClient.post).toHaveBeenNthCalledWith(1, `${BASE}/bt-1/approve`, {});
    expect(tenantClient.post).toHaveBeenNthCalledWith(2, `${BASE}/bt-1/reject`, { reason: 'Rack is closed' });
    expect(tenantClient.post).toHaveBeenNthCalledWith(3, `${BASE}/bt-1/complete`, {});
  });

  it('remove deletes and history reads the trail', async () => {
    vi.mocked(tenantClient.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, records: [{ action: 'create', at: 'x', byName: 'Sam' }] } });

    await binTransferService.remove('bt-1');
    const trail = await binTransferService.history('bt-1');

    expect(tenantClient.delete).toHaveBeenCalledWith(`${BASE}/bt-1`);
    expect(tenantClient.get).toHaveBeenCalledWith(`${BASE}/bt-1/history`);
    expect(trail).toHaveLength(1);
  });
});
