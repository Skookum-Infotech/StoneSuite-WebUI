import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { post: vi.fn(), patch: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { fabricationService } from './fabricationService';

const post = vi.mocked(tenantClient.post);
const patch = vi.mocked(tenantClient.patch);

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ data: { success: true, fabricationJob: { id: 'job-1' } } });
  patch.mockResolvedValue({ data: { success: true, step: { code: 'SAW_CUTTING' } } });
});

// Request shapes the backend now relies on: a step update names its piece, and
// job creation carries an idempotency key so a retry cannot open a duplicate.
describe('fabricationService request contract', () => {
  it('sends pieceUuid when updating a piece-grain step', async () => {
    await fabricationService.updateStep('job-1', 'SAW_CUTTING', { status: 'completed', pieceUuid: 'piece-2' });
    expect(patch).toHaveBeenCalledWith('/tenant/fabrication-jobs/job-1/steps/SAW_CUTTING', {
      status: 'completed', pieceUuid: 'piece-2',
    });
  });

  it('sends requestId when creating a job', async () => {
    await fabricationService.createJob({ salesOrderUuid: 'so-1', requestId: 'req-1' } as never);
    expect(post).toHaveBeenCalledWith('/tenant/fabrication-jobs', expect.objectContaining({
      salesOrderUuid: 'so-1', requestId: 'req-1',
    }));
  });

  it('sends requestId when fabricating from an order, and nothing extra without one', async () => {
    await fabricationService.fabricateFromOrder('so-1', undefined, 'req-2');
    expect(post).toHaveBeenLastCalledWith('/tenant/sales-orders/so-1/fabricate', { requestId: 'req-2' });

    await fabricationService.fabricateFromOrder('so-1');
    expect(post).toHaveBeenLastCalledWith('/tenant/sales-orders/so-1/fabricate', {});
  });
});
